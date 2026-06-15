"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser client — uses the public anon key and respects RLS as the signed-in admin.
// Used for client-side reads/realtime where the admin's own session is enough.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
