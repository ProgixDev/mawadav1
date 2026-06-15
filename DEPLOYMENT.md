# Deploying to Vercel

The dashboard is a standard Next.js 16 App Router app. No `vercel.json` is
required — Vercel auto-detects the build (`next build`) and output.

## 1. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (for all
environments). They are the same names as `.env.example`:

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production / Preview / Dev | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production / Preview / Dev | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Production / Preview / Dev | **Secret** — never prefix with `NEXT_PUBLIC` |

`.env.local` is git-ignored and is **not** read by Vercel — you must add these
in the dashboard.

## 2. Co-locate the region with Supabase (biggest latency win)

Every page hits Supabase, and `src/proxy.ts` calls `auth.getUser()` on every
request. The dominant latency is the round-trip between the Vercel function and
the Supabase database, so they must be in the **same region**.

1. Supabase → Project Settings → General → note the **Region** (e.g.
   `West EU (Ireland)`, `East US (N. Virginia)`).
2. Vercel → Project Settings → **Functions → Region** → pick the matching one:
   - West EU (Ireland) → `dub1`
   - East US (N. Virginia) → `iad1` (Vercel default)
   - Central EU (Frankfurt) → `fra1`
   - Southeast Asia (Singapore) → `sin1`

Picking the wrong (far) region is the single most common cause of a "slow"
Vercel + Supabase deployment.

## 3. Build settings

Vercel defaults are correct:
- Build command: `next build`
- Install command: `npm install`
- Output: handled automatically by the Next.js framework preset.

## Performance notes (already in place)

- Dashboard stats are cached for 60s (`unstable_cache` in `src/lib/data/stats.ts`),
  so navigation doesn't re-run ~15 Supabase count queries each time.
- All independent Supabase queries run in parallel (`Promise.all`).
- `recharts`, `lucide-react`, and `date-fns` are tree-shaken automatically by
  Next 16's default `optimizePackageImports`.
- `poweredByHeader` is disabled and HSTS / `nosniff` / `X-Frame-Options` /
  `Referrer-Policy` headers are set in `next.config.ts`.
