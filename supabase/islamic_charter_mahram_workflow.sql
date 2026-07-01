-- =============================================================================
-- MAWADA — Islamic Charter, Mahram role + approval workflow, religious criteria,
--          Super Admin role, and in-app notifications.
-- Run this ONCE in the Supabase SQL Editor, AFTER:
--   admin_dashboard_setup.sql, partner_preferences_matching_columns.sql,
--   matching_importance.sql, matching_requests.sql.
-- Idempotent: safe to re-run.
--
-- What it adds (see each numbered section):
--   1. Roles            — 'super_admin' and 'mahram' role values; is_super_admin();
--                         is_admin() now also true for super admins.
--   2. Islamic Charter  — users.charter_accepted (+ accepted_at). The mobile app
--                         gates platform access on this flag.
--   3. Religious fields — profiles.prayer_frequency (all) and profiles.wears_hijab
--                         (female only).
--   4. Mahram accounts  — mahram_links (one mahram supervises many female wards),
--                         claim_mahram_links() to auto-link a mahram account by the
--                         phone number the woman entered at onboarding.
--   5. Approval flow    — matches.mahram_status (pending|approved|rejected) +
--                         'rejected' status; mahram_respond_to_match() approves or
--                         rejects, and on approval opens a DIRECT male<->female
--                         conversation (chat/audio/video become available).
--   6. Direct chat      — conversations.kind ('support'|'direct') + peer_user_id,
--                         plus RLS so both participants of a direct thread can
--                         read/send. Access is gated on mahram approval.
--   7. Notifications    — public.notifications + notify() helper. Records are
--                         created for mahrams and users at each workflow step.
-- =============================================================================


-- =============================================================================
-- 1. ROLES — add 'super_admin' and 'mahram'.
-- =============================================================================
-- Relax users.role to the new set. The original constraint name is unknown
-- across environments, so drop any CHECK referencing role, then re-add ours.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.users drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.users
  add constraint users_role_check
  check (role = any (array['user','admin','super_admin','mahram']));

-- Admins INCLUDE super admins everywhere is_admin() is used (dashboard, RLS).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin','super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'super_admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;


-- =============================================================================
-- 2. ISLAMIC CHARTER — mandatory acceptance before accessing the platform.
-- =============================================================================
alter table public.users
  add column if not exists charter_accepted boolean not null default false;
alter table public.users
  add column if not exists charter_accepted_at timestamp with time zone;

comment on column public.users.charter_accepted is
  'Islamic Charter acceptance. The mobile app blocks access to the platform '
  'until this is true (genuine marriage intention, modesty, respectful '
  'communication, no inappropriate content).';

-- The user accepts the charter from their own session. SECURITY DEFINER so the
-- single-column write does not require a broad UPDATE grant on users.
create or replace function public.accept_charter()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
    set charter_accepted = true,
        charter_accepted_at = current_timestamp,
        updated_at = current_timestamp
    where id = auth.uid();
end;
$$;

grant execute on function public.accept_charter() to authenticated;


-- =============================================================================
-- 3. RELIGIOUS CRITERIA — prayer (everyone) + hijab (female profiles).
-- =============================================================================
--   prayer_frequency: regularly  -> "Yes, I pray regularly"
--                     sometimes  -> "I pray but not regularly"
--                     never      -> "No, I do not pray"
--   wears_hijab:      female-only boolean (true = yes, false = no, null = unset)
alter table public.profiles
  add column if not exists prayer_frequency text
    check (prayer_frequency is null
           or prayer_frequency = any (array['regularly','sometimes','never']));
alter table public.profiles
  add column if not exists wears_hijab boolean;

comment on column public.profiles.prayer_frequency is
  'Prayer habit (religious criterion, heavy weight in compatibility): '
  'regularly | sometimes | never.';
comment on column public.profiles.wears_hijab is
  'Female profiles only. Whether she wears the hijab (religious criterion).';


-- =============================================================================
-- 4. MAHRAM ACCOUNTS — link a mahram user to the female profiles he supervises.
-- =============================================================================
create table if not exists public.mahram_links (
  id              uuid primary key default gen_random_uuid(),
  mahram_user_id  uuid not null references public.users(id) on delete cascade,
  female_user_id  uuid not null references public.users(id) on delete cascade,
  created_at      timestamp with time zone default current_timestamp,
  unique (mahram_user_id, female_user_id)
);

create index if not exists mahram_links_mahram_idx on public.mahram_links (mahram_user_id);
create index if not exists mahram_links_female_idx on public.mahram_links (female_user_id);

-- Normalise a phone number to its last 10 digits for tolerant matching between
-- the format the woman typed (e.g. "+1 514 000 0000") and the mahram's auth phone.
create or replace function public.phone_digits10(p text)
returns text
language sql
immutable
as $$
  select right(regexp_replace(coalesce(p,''), '\D', '', 'g'), 10);
$$;

-- Called by an authenticated mahram account (after signup) to claim supervision
-- of every female whose onboarding mahram phone matches the caller's. Also
-- promotes the caller to the 'mahram' role. Returns the number of wards linked.
create or replace function public.claim_mahram_links()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  my_phone text;
  linked   integer := 0;
begin
  select phone into my_phone from public.users where id = uid;
  if my_phone is null or length(public.phone_digits10(my_phone)) < 10 then
    return 0;
  end if;

  -- Promote to mahram (never downgrade an existing admin/super_admin).
  update public.users
    set role = 'mahram', updated_at = current_timestamp
    where id = uid and role = 'user';

  insert into public.mahram_links (mahram_user_id, female_user_id)
  select uid, mh.female_user_id
    from public.mahrams mh
    where public.phone_digits10(mh.phone_number) = public.phone_digits10(my_phone)
      and mh.female_user_id <> uid
  on conflict (mahram_user_id, female_user_id) do nothing;

  get diagnostics linked = row_count;
  return linked;
end;
$$;

grant execute on function public.claim_mahram_links() to authenticated;

-- Is the caller a mahram supervising this female?
create or replace function public.is_mahram_of(p_female uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mahram_links ml
    where ml.mahram_user_id = auth.uid() and ml.female_user_id = p_female
  );
$$;

grant execute on function public.is_mahram_of(uuid) to authenticated;

alter table public.mahram_links enable row level security;
grant select on table public.mahram_links to authenticated;

drop policy if exists "Mahram reads own links" on public.mahram_links;
create policy "Mahram reads own links"
on public.mahram_links for select to authenticated
using (mahram_user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage mahram links" on public.mahram_links;
create policy "Admins manage mahram links"
on public.mahram_links for all to authenticated
using (public.is_admin()) with check (public.is_admin());


-- =============================================================================
-- 7. NOTIFICATIONS — in-app, realtime. (Defined before the workflow that uses it.)
-- =============================================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade, -- recipient
  type        text not null,   -- match_awaiting_mahram | match_approved | match_rejected
                                -- | mahram_new_match | mahram_needs_approval
  title       text,
  body        text,
  data        jsonb not null default '{}',  -- { match_id, ... }
  read_at     timestamp with time zone,
  created_at  timestamp with time zone default current_timestamp
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
grant select, update on table public.notifications to authenticated;

drop policy if exists "Recipients read own notifications" on public.notifications;
create policy "Recipients read own notifications"
on public.notifications for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Recipients update own notifications" on public.notifications;
create policy "Recipients update own notifications"
on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Admins manage notifications" on public.notifications;
create policy "Admins manage notifications"
on public.notifications for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Insert a notification (used by the workflow functions below).
create or replace function public.notify(
  p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
$$;

-- Mark one / all of the caller's notifications read.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
    set read_at = current_timestamp
    where user_id = auth.uid()
      and read_at is null
      and (p_ids is null or id = any (p_ids));
end;
$$;

grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;


-- =============================================================================
-- 6. DIRECT CONVERSATIONS — a male<->female thread opened after mahram approval.
--    The existing conversations are concierge ('support') threads with one
--    user_id; a 'direct' thread additionally has peer_user_id (the partner).
-- =============================================================================
alter table public.conversations
  add column if not exists kind text not null default 'support'
    check (kind = any (array['support','direct']));
alter table public.conversations
  add column if not exists peer_user_id uuid references public.users(id) on delete cascade;

create index if not exists conversations_peer_idx on public.conversations (peer_user_id);
create index if not exists conversations_match_idx on public.conversations (match_id);

-- Either participant of a DIRECT thread may read it and send to it. (Support
-- threads keep their existing user_id-only policies from chat_permissions.sql.)
drop policy if exists "Peers can read their direct conversation" on public.conversations;
create policy "Peers can read their direct conversation"
on public.conversations for select to authenticated
using (kind = 'direct' and (user_id = auth.uid() or peer_user_id = auth.uid()));

drop policy if exists "Peers can read messages in their direct conversation" on public.messages;
create policy "Peers can read messages in their direct conversation"
on public.messages for select to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.kind = 'direct'
      and (c.user_id = auth.uid() or c.peer_user_id = auth.uid())
  )
);

drop policy if exists "Peers can send to their direct conversation" on public.messages;
create policy "Peers can send to their direct conversation"
on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.kind = 'direct'
      and (c.user_id = auth.uid() or c.peer_user_id = auth.uid())
  )
);


-- =============================================================================
-- 5. APPROVAL WORKFLOW — mahram_status on matches + mahram_respond_to_match().
-- =============================================================================
-- mahram_status: pending  -> both users accepted, awaiting the mahram
--                approved -> mahram approved, direct conversation opened
--                rejected -> mahram rejected, everything stays locked
alter table public.matches
  add column if not exists mahram_status text not null default 'pending'
    check (mahram_status = any (array['pending','approved','rejected']));

-- Allow the new overall status 'rejected' (mahram rejected the match).
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status = any (array['pending','matched','declined','expired','cancelled','ended','rejected']));

-- Grandfather any pre-existing confirmed matches: their conversations already
-- work, so treat them as already mahram-approved (don't lock live chats).
update public.matches set mahram_status = 'approved'
  where status = 'matched' and mahram_status = 'pending';

-- ---------------------------------------------------------------------------
-- Rework respond_to_match(): on mutual acceptance the match becomes 'matched'
-- but mahram_status STAYS 'pending' — NO conversation is opened yet. Instead we
-- notify the woman's mahram(s) and both users that approval is pending.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_match(p_match_id uuid, p_response text)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m       public.matches;
  uid     uuid := auth.uid();
  ml      record;
begin
  if p_response not in ('accepted','declined') then
    raise exception 'invalid response: %', p_response;
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match not found';
  end if;

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

  if m.male_response = 'declined' or m.female_response = 'declined' then
    update public.matches set status = 'declined', updated_at = current_timestamp
      where id = m.id returning * into m;

  elsif m.male_response = 'accepted' and m.female_response = 'accepted' then
    -- Mutual like. Confirm the pairing but keep it locked behind mahram approval.
    update public.matches
      set status = 'matched', mahram_status = 'pending', updated_at = current_timestamp
      where id = m.id returning * into m;

    -- Exclusivity: cancel every other still-pending request for either user.
    update public.matches
      set status = 'cancelled', updated_at = current_timestamp
      where id <> m.id
        and status = 'pending'
        and (male_user_id in (m.male_user_id, m.female_user_id)
          or female_user_id in (m.male_user_id, m.female_user_id));

    -- Notify both users that the match awaits the mahram's decision.
    perform public.notify(m.male_user_id, 'match_awaiting_mahram',
      null, null, jsonb_build_object('match_id', m.id));
    perform public.notify(m.female_user_id, 'match_awaiting_mahram',
      null, null, jsonb_build_object('match_id', m.id));

    -- Notify every mahram supervising the woman.
    for ml in
      select mahram_user_id from public.mahram_links where female_user_id = m.female_user_id
    loop
      perform public.notify(ml.mahram_user_id, 'mahram_needs_approval',
        null, null, jsonb_build_object('match_id', m.id,
          'female_user_id', m.female_user_id, 'male_user_id', m.male_user_id));
    end loop;
  end if;

  return m;
end;
$$;

grant execute on function public.respond_to_match(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- mahram_respond_to_match(): the linked mahram (or an admin) approves/rejects.
--   approve -> open the direct male<->female conversation (chat/calls unlocked),
--              deliver the mahram contact card, notify both users.
--   reject  -> status 'rejected', everything stays locked, notify both users.
-- ---------------------------------------------------------------------------
create or replace function public.mahram_respond_to_match(p_match_id uuid, p_response text)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m        public.matches;
  conv_id  uuid;
begin
  if p_response not in ('approved','rejected') then
    raise exception 'invalid response: %', p_response;
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match not found';
  end if;

  -- Authorisation: a mahram of the woman, an admin, or the service role (the
  -- web dashboard's admin client, which has no auth.uid() but is fully trusted).
  if not (
    public.is_mahram_of(m.female_user_id)
    or public.is_admin()
    or auth.role() = 'service_role'
  ) then
    raise exception 'not authorised to approve this match';
  end if;

  if m.status <> 'matched' or m.mahram_status <> 'pending' then
    raise exception 'match is not awaiting mahram approval (status: %, mahram: %)',
      m.status, m.mahram_status;
  end if;

  if p_response = 'rejected' then
    update public.matches
      set mahram_status = 'rejected', status = 'rejected', updated_at = current_timestamp
      where id = m.id returning * into m;

    perform public.notify(m.male_user_id, 'match_rejected',
      null, null, jsonb_build_object('match_id', m.id));
    perform public.notify(m.female_user_id, 'match_rejected',
      null, null, jsonb_build_object('match_id', m.id));
    return m;
  end if;

  -- Approved.
  update public.matches
    set mahram_status = 'approved', updated_at = current_timestamp
    where id = m.id returning * into m;

  -- Open (or reuse) the DIRECT male<->female conversation for this match.
  select id into conv_id
    from public.conversations
    where kind = 'direct' and match_id = m.id
    limit 1;

  if conv_id is null then
    insert into public.conversations (user_id, peer_user_id, kind, match_id, last_message_at)
      values (m.male_user_id, m.female_user_id, 'direct', m.id, current_timestamp)
      returning id into conv_id;
  end if;

  -- Deliver the female's mahram contact card into the new direct thread.
  perform public.deliver_mahram_to_male(m.id);

  perform public.notify(m.male_user_id, 'match_approved',
    null, null, jsonb_build_object('match_id', m.id, 'conversation_id', conv_id));
  perform public.notify(m.female_user_id, 'match_approved',
    null, null, jsonb_build_object('match_id', m.id, 'conversation_id', conv_id));

  return m;
end;
$$;

grant execute on function public.mahram_respond_to_match(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Re-point deliver_mahram_to_male() at the DIRECT conversation for the match
-- (created on approval) instead of the male's concierge thread.
-- ---------------------------------------------------------------------------
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
  body_txt text;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or m.mahram_delivered then
    return;
  end if;

  select * into mh from public.mahrams where female_user_id = m.female_user_id;

  select id into conv_id
    from public.conversations
    where kind = 'direct' and match_id = m.id
    limit 1;
  if conv_id is null then
    insert into public.conversations (user_id, peer_user_id, kind, match_id, last_message_at)
      values (m.male_user_id, m.female_user_id, 'direct', m.id, current_timestamp)
      returning id into conv_id;
  end if;

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

  -- System message: sender is the male participant (the card is informational).
  insert into public.messages (conversation_id, sender_id, body, moderation_status)
    values (conv_id, m.male_user_id, body_txt, 'ok');

  update public.conversations
    set last_message_at = current_timestamp, updated_at = current_timestamp
    where id = conv_id;

  update public.matches set mahram_delivered = true, updated_at = current_timestamp
    where id = m.id;
end;
$$;


-- =============================================================================
-- 8. MAHRAM READ ACCESS + the approvals feed the mobile mahram screen reads.
-- =============================================================================

-- A mahram may READ the match rows for the women he supervises (so the mobile
-- app's realtime subscription on `matches` delivers their updates).
drop policy if exists "Mahram can read wards' matches" on public.matches;
create policy "Mahram can read wards' matches"
on public.matches for select to authenticated
using (public.is_mahram_of(female_user_id));

-- The mahram approvals feed: every match concerning a ward, with both parties'
-- display names, newest first. SECURITY DEFINER so the mahram doesn't need broad
-- read access to other users' profiles — only this curated projection.
create or replace function public.mahram_approvals()
returns table (
  match_id        uuid,
  status          text,
  mahram_status   text,
  mutual_score    integer,
  female_user_id  uuid,
  female_name     text,
  male_user_id    uuid,
  male_name       text,
  created_at      timestamp with time zone,
  updated_at      timestamp with time zone
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.status,
    m.mahram_status,
    m.mutual_score,
    m.female_user_id,
    trim(both ' ' from coalesce(fp.first_name,'') || ' ' || coalesce(fp.last_name,'')),
    m.male_user_id,
    trim(both ' ' from coalesce(mp.first_name,'') || ' ' || coalesce(mp.last_name,'')),
    m.created_at,
    m.updated_at
  from public.matches m
  join public.mahram_links ml
    on ml.female_user_id = m.female_user_id and ml.mahram_user_id = auth.uid()
  left join public.profiles fp on fp.user_id = m.female_user_id
  left join public.profiles mp on mp.user_id = m.male_user_id
  where m.status in ('matched','rejected')
  order by
    case when m.status = 'matched' and m.mahram_status = 'pending' then 0 else 1 end,
    m.updated_at desc;
$$;

grant execute on function public.mahram_approvals() to authenticated;


-- =============================================================================
-- DONE. Promote your own account to super admin (run once):
--   update public.users set role = 'super_admin' where email = 'you@example.com';
-- =============================================================================
