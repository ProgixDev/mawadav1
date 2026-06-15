-- =============================================================================
-- MAWADA — Admin-initiated match requests + onboarding red flags.
-- Run this ONCE in the Supabase SQL Editor (after admin_dashboard_setup.sql and
-- partner_preferences_matching_columns.sql). Idempotent: safe to re-run.
--
-- What it adds:
--   1. partner_preferences.red_flags  — onboarding dealbreakers that turn a soft
--      criterion into a HARD incompatibility (smoking, different madhab,
--      different country, won't relocate, different language).
--   2. public.matches               — one admin-introduced pairing (a male + a
--      female), each side accepts/declines, expires 3 days after it is sent.
--   3. public.respond_to_match()    — the ONLY way a user records a response;
--      enforces participation + expiry, and on mutual acceptance delivers the
--      female's mahram contact card into the male's chat thread.
--   4. RLS + grants so each user sees only their own match requests and the
--      admin (service role + admin session) sees everything.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Red flags (dealbreakers) chosen during onboarding.
--    Stored on the seeker's partner_preferences row. Each value flips a soft
--    criterion into a hard gate inside the compatibility scorer.
--      smoking            -> partner who smokes (occasionally|regularly) is rejected
--      different_madhab   -> partner of a different madhab is rejected
--      different_country  -> partner in a different country is rejected
--      wont_relocate      -> partner unwilling to relocate (when countries differ) is rejected
--      different_language -> partner sharing no common preferred language is rejected
-- -----------------------------------------------------------------------------
alter table public.partner_preferences
  add column if not exists red_flags text[] not null default '{}';

comment on column public.partner_preferences.red_flags is
  'Onboarding dealbreakers. Each value upgrades a soft criterion to a hard gate: '
  'smoking | different_madhab | different_country | wont_relocate | different_language.';

-- -----------------------------------------------------------------------------
-- 2. Matches — an admin introduces exactly one male and one female.
-- -----------------------------------------------------------------------------
create table if not exists public.matches (
  id                 uuid primary key default gen_random_uuid(),
  male_user_id       uuid not null references public.users(id) on delete cascade,
  female_user_id     uuid not null references public.users(id) on delete cascade,
  created_by         uuid references public.users(id),          -- admin who sent it
  mutual_score       integer,                                   -- compatibility snapshot at send time
  mutual_pass        boolean,
  -- Overall lifecycle, derived from the two per-side responses + expiry.
  -- 'ended' = a confirmed match the admin later dissolved (it did not work out);
  -- both people are then free to be matched again.
  status             text not null default 'pending'
    check (status = any (array['pending','matched','declined','expired','cancelled','ended'])),
  male_response      text not null default 'pending'
    check (male_response = any (array['pending','accepted','declined'])),
  female_response    text not null default 'pending'
    check (female_response = any (array['pending','accepted','declined'])),
  male_responded_at  timestamp with time zone,
  female_responded_at timestamp with time zone,
  expires_at         timestamp with time zone not null default (current_timestamp + interval '3 days'),
  mahram_delivered   boolean not null default false,
  created_at         timestamp with time zone default current_timestamp,
  updated_at         timestamp with time zone default current_timestamp
);

-- At most one *live* (pending) request per male+female pair.
create unique index if not exists matches_unique_pending_pair
  on public.matches (male_user_id, female_user_id)
  where status = 'pending';

create index if not exists matches_male_idx   on public.matches (male_user_id);
create index if not exists matches_female_idx on public.matches (female_user_id);
create index if not exists matches_status_idx on public.matches (status);

-- Ensure the status check allows 'ended' even on a pre-existing table.
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status = any (array['pending','matched','declined','expired','cancelled','ended']));

-- Now that matches exists, wire up the dangling conversations.match_id pointer.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'conversations_match_id_fkey'
      and table_name = 'conversations'
  ) then
    alter table public.conversations
      add constraint conversations_match_id_fkey
      foreign key (match_id) references public.matches(id) on delete set null;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3a. Deliver the female's mahram contact into the male's chat thread.
--     Posts a single structured message (type=mahram_info) the mobile chat
--     renders as a contact card. Idempotent via matches.mahram_delivered.
-- -----------------------------------------------------------------------------
create or replace function public.deliver_mahram_to_male(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m        public.matches;
  mh       public.mahrams;
  conv_id  uuid;
  sender   uuid;
  body_txt text;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.mahram_delivered then
    return;
  end if;

  select * into mh from public.mahrams where female_user_id = m.female_user_id;

  -- The male's support thread (one conversation per user); create if missing.
  select id, admin_id into conv_id, sender
    from public.conversations where user_id = m.male_user_id;
  if conv_id is null then
    insert into public.conversations (user_id, match_id)
      values (m.male_user_id, m.id)
      returning id, admin_id into conv_id, sender;
  else
    update public.conversations set match_id = m.id, updated_at = current_timestamp
      where id = conv_id;
  end if;

  -- Sender is the handling admin (falls back to the admin who sent the match).
  sender := coalesce(sender, m.created_by, m.female_user_id);

  body_txt := json_build_object(
    'type', 'mahram_info',
    'match_id', m.id,
    'mahram', json_build_object(
      'full_name',    coalesce(mh.full_name, ''),
      'relationship', coalesce(mh.relationship, ''),
      'phone_number', coalesce(mh.phone_number, ''),
      'country',      coalesce(mh.country, ''),
      'city',         coalesce(mh.city, '')
    )
  )::text;

  insert into public.messages (conversation_id, sender_id, body, moderation_status)
    values (conv_id, sender, body_txt, 'ok');

  update public.conversations
    set last_message_at = current_timestamp, updated_at = current_timestamp
    where id = conv_id;

  update public.matches set mahram_delivered = true, updated_at = current_timestamp
    where id = m.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3b. Record a participant's response. The only sanctioned write path for users.
--     Enforces: caller is a participant, request is still pending, not expired.
--     On both-accepted -> status 'matched' + mahram delivery.
-- -----------------------------------------------------------------------------
create or replace function public.respond_to_match(p_match_id uuid, p_response text)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m   public.matches;
  uid uuid := auth.uid();
begin
  if p_response not in ('accepted','declined') then
    raise exception 'invalid response: %', p_response;
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match not found';
  end if;

  -- Lazily expire before accepting any new response.
  if m.status = 'pending' and m.expires_at < now() then
    update public.matches set status = 'expired', updated_at = current_timestamp
      where id = m.id returning * into m;
  end if;

  if m.status <> 'pending' then
    raise exception 'match is no longer pending (status: %)', m.status;
  end if;

  if uid = m.male_user_id then
    update public.matches
      set male_response = p_response, male_responded_at = current_timestamp,
          updated_at = current_timestamp
      where id = m.id returning * into m;
  elsif uid = m.female_user_id then
    update public.matches
      set female_response = p_response, female_responded_at = current_timestamp,
          updated_at = current_timestamp
      where id = m.id returning * into m;
  else
    raise exception 'not a participant in this match';
  end if;

  -- Recompute overall status from the two sides.
  if m.male_response = 'declined' or m.female_response = 'declined' then
    update public.matches set status = 'declined', updated_at = current_timestamp
      where id = m.id returning * into m;
  elsif m.male_response = 'accepted' and m.female_response = 'accepted' then
    update public.matches set status = 'matched', updated_at = current_timestamp
      where id = m.id returning * into m;

    -- Exclusivity: the pair is now in a confirmed one-to-one match. Cancel every
    -- other still-pending request involving either participant so that no second
    -- match can ever form for an already-matched person.
    update public.matches
      set status = 'cancelled', updated_at = current_timestamp
      where id <> m.id
        and status = 'pending'
        and (male_user_id in (m.male_user_id, m.female_user_id)
          or female_user_id in (m.male_user_id, m.female_user_id));

    perform public.deliver_mahram_to_male(m.id);
    select * into m from public.matches where id = m.id;  -- refresh mahram_delivered
  end if;

  return m;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3c. Enforce one-to-one exclusivity at insert time: an admin cannot create a
--     new request for a user who is already in a confirmed ('matched') match.
-- -----------------------------------------------------------------------------
create or replace function public.matches_enforce_exclusivity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.matches m
    where m.status = 'matched'
      and (
        m.male_user_id   in (new.male_user_id, new.female_user_id) or
        m.female_user_id in (new.male_user_id, new.female_user_id)
      )
  ) then
    raise exception 'one or both users are already in a confirmed match'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_matches_exclusivity on public.matches;
create trigger trg_matches_exclusivity
  before insert on public.matches
  for each row execute function public.matches_enforce_exclusivity();

grant execute on function public.respond_to_match(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. RLS + grants.
--    Users may READ matches they belong to; all writes go through
--    respond_to_match() (security definer), so no direct insert/update grant.
--    Admin paths already work via the service-role key (bypasses RLS) and the
--    is_admin() policies below cover the admin's own browser session.
-- -----------------------------------------------------------------------------
alter table public.matches enable row level security;

grant select on table public.matches to authenticated;

drop policy if exists "Participants can read their matches" on public.matches;
create policy "Participants can read their matches"
on public.matches for select to authenticated
using (
  male_user_id = auth.uid()
  or female_user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "Admins can manage matches" on public.matches;
create policy "Admins can manage matches"
on public.matches for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Keep the service-role default grants consistent for the new table.
grant all privileges on table public.matches to service_role;

-- -----------------------------------------------------------------------------
-- 5. Admin convenience: latest match-request status per user, for sorting the
--    users / matching lists ("sent / accepted / declined / matched / expired").
-- -----------------------------------------------------------------------------
-- security_invoker = on: the view evaluates RLS/permissions as the *querying*
-- user, not the view owner. Without it Postgres treats the view as SECURITY
-- DEFINER, letting any caller read every user's match status (flagged by the
-- Supabase linter). service_role still bypasses RLS for the admin dashboard.
create or replace view public.user_match_status
with (security_invoker = on) as
select
  u.id as user_id,
  lm.id as latest_match_id,
  lm.status as latest_status,
  case
    when lm.id is null then 'none'
    when u.id = lm.male_user_id then lm.male_response
    else lm.female_response
  end as own_response,
  lm.expires_at,
  lm.updated_at
from public.users u
left join lateral (
  select m.*
  from public.matches m
  where m.male_user_id = u.id or m.female_user_id = u.id
  order by m.created_at desc
  limit 1
) lm on true;

grant select on public.user_match_status to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Realtime — the mobile app subscribes to `matches` for live request updates
--    and the countdown. Add the table to the realtime publication (idempotent).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
