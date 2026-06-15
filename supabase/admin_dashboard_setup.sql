-- =============================================================================
-- MAWADA Admin Dashboard — Supabase setup
-- Run this ONCE in the Supabase SQL Editor.
--
-- The web dashboard reads/writes cross-user data via the service-role key on the
-- server, which BYPASSES RLS — so the dashboard works even without the policies
-- below. These admin policies are still recommended because they let the admin's
-- own browser session (anon key) receive Realtime chat updates and read data
-- directly, exactly like the mobile app does.
--
-- An "admin" is a row in public.users whose role = 'admin'.
-- =============================================================================

-- Helper: is the currently authenticated user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;


grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- Content library — used by the dashboard's /content section. This table is not
-- part of the mobile-app schema, so create it here if it does not yet exist.
-- Columns match src/lib/types/database.ts (ContentItemRow).
-- -----------------------------------------------------------------------------
create table if not exists public.content_items (
  id uuid not null default gen_random_uuid(),
  type text not null default 'article'::text
    check (type = any (array['article'::text, 'checklist'::text, 'guide'::text, 'istikhara'::text])),
  title text not null,
  body_md text not null default ''::text,
  tags text[] default '{}'::text[],
  published boolean not null default false,
  sort_order integer default 0,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp,
  constraint content_items_pkey primary key (id)
);

-- -----------------------------------------------------------------------------
-- Service-role privileges (REQUIRED for the dashboard to work at all).
-- The web dashboard talks to Supabase with the service-role key. That role
-- bypasses RLS, but it STILL needs table-level GRANTs — and in this project the
-- default grants are missing, so every server query fails with
-- "permission denied for table ...". Restore full access for service_role here.
-- -----------------------------------------------------------------------------
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;
-- Same safety net for any tables created later.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- Make sure admins have the table privileges they need.
grant select, update on table public.users to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.mahrams to authenticated;
grant select on table public.partner_preferences to authenticated;
grant select, insert, update on table public.conversations to authenticated;
grant select, insert, update on table public.messages to authenticated;
grant select, insert, update, delete on table public.content_items to authenticated;
grant select on table public.subscriptions to authenticated;
grant select, update on table public.reports to authenticated;

-- -----------------------------------------------------------------------------
-- Admin read access across every user-owned table.
-- -----------------------------------------------------------------------------
drop policy if exists "Admins can read all users" on public.users;
create policy "Admins can read all users"
on public.users for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can update all users" on public.users;
create policy "Admins can update all users"
on public.users for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
on public.profiles for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can read all mahrams" on public.mahrams;
create policy "Admins can read all mahrams"
on public.mahrams for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can read all partner_preferences" on public.partner_preferences;
create policy "Admins can read all partner_preferences"
on public.partner_preferences for select to authenticated
using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Conversations & messages — admins can read every thread, reply, and moderate.
-- -----------------------------------------------------------------------------
drop policy if exists "Admins can read all conversations" on public.conversations;
create policy "Admins can read all conversations"
on public.conversations for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can update all conversations" on public.conversations;
create policy "Admins can update all conversations"
on public.conversations for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can read all messages" on public.messages;
create policy "Admins can read all messages"
on public.messages for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can send messages to any conversation" on public.messages;
create policy "Admins can send messages to any conversation"
on public.messages for insert to authenticated
with check (public.is_admin() and sender_id = auth.uid());

drop policy if exists "Admins can moderate any message" on public.messages;
create policy "Admins can moderate any message"
on public.messages for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Content — admins manage; everyone may read published items.
-- -----------------------------------------------------------------------------
alter table public.content_items enable row level security;

drop policy if exists "Anyone can read published content" on public.content_items;
create policy "Anyone can read published content"
on public.content_items for select to authenticated
using (published = true or public.is_admin());

drop policy if exists "Admins can manage content" on public.content_items;
create policy "Admins can manage content"
on public.content_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Subscriptions & reports — admins read/triage.
-- -----------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
drop policy if exists "Admins can read all subscriptions" on public.subscriptions;
create policy "Admins can read all subscriptions"
on public.subscriptions for select to authenticated
using (public.is_admin());

alter table public.reports enable row level security;
drop policy if exists "Admins can read all reports" on public.reports;
create policy "Admins can read all reports"
on public.reports for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can update reports" on public.reports;
create policy "Admins can update reports"
on public.reports for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Realtime — the dashboard subscribes to `messages` (inside each conversation)
-- and to both `messages` + `conversations` (the inbox list) for live updates.
-- Add the tables to the realtime publication (idempotent).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Promote a user to admin (run once for your own account):
--   update public.users set role = 'admin' where email = 'you@example.com';
-- -----------------------------------------------------------------------------
