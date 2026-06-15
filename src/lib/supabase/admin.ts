import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client. BYPASSES RLS — full read/write across every user's data.
// MUST only ever run on the server. Never import this into a client component.
// All admin dashboard data access goes through this client, gated behind an
// admin-role check (see requireAdmin in src/lib/auth.ts).
//
// The client is stateless (no session persistence), so we build it once and
// reuse the singleton. Previously every call created a fresh client — a single
// dashboard load spins up 15+ of them, which is pure overhead.
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key === "REPLACE_WITH_SERVICE_ROLE_KEY") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (Supabase Dashboard -> Settings -> API).",
    );
  }

  cached = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
