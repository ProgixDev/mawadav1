# MAWADA Admin Dashboard

Web admin dashboard for the MAWADA Muslim matchmaking app. Shares the same
Supabase backend as the Flutter mobile app (same database, same schema).

Built with **Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase**.

## Features

- **Overview** — KPIs and charts (users, subscriptions, conversations, reports, sign-ups).
- **Users** — search/filter members, view full profile (Islamic profile, partner
  preferences, mahram), suspend/reactivate.
- **Conversations** — concierge inbox; admins chat with members in realtime, set
  conversation stage (new / in contact / paused), moderate messages inline.
- **Moderation** — triage reports and flagged messages.
- **Content** — CRUD for articles, guides, checklists, and istikhara; publish toggle.
- **Subscriptions** — RevenueCat entitlement overview.
- **Matching** — placeholder; matchmaking workflow to be designed.

## Architecture

- **Auth**: Supabase Auth. Only users with `role = 'admin'` can sign in (enforced
  in `src/lib/auth.ts`).
- **Data access**: All cross-user reads/writes go through the Supabase
  **service-role key on the server** (`src/lib/supabase/admin.ts`), which bypasses
  RLS. The key never reaches the browser.
- **Realtime chat**: uses the browser client (admin session). Requires the admin
  RLS policies in `supabase/admin_dashboard_setup.sql`. A 10s polling fallback
  keeps chat working even without them.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already set
     to the shared project).
   - `SUPABASE_SERVICE_ROLE_KEY` — **required**. Supabase Dashboard → Project
     Settings → API → `service_role` secret key.

3. Apply the admin DB setup once in the Supabase SQL Editor:
   ```
   supabase/admin_dashboard_setup.sql
   ```
   Then promote your account:
   ```sql
   update public.users set role = 'admin' where email = 'you@example.com';
   ```

4. Run:
   ```bash
   npm run dev      # http://localhost:3000
   npm run build    # production build
   ```
