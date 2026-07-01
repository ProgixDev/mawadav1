import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRow } from "@/lib/types/database";

// Returns the signed-in admin's user row, or null if not signed in / not an admin.
// Wrapped in React cache() so the layout + page within a single request share
// one lookup instead of each making their own auth + DB round trip.
export const getAdminUser = cache(async function getAdminUser(): Promise<UserRow | null> {
  const supabase = await createClient();
  // getClaims() verifies the JWT locally when the project uses asymmetric signing
  // keys (no network round trip), and falls back to a getUser() network call only
  // for legacy HS256 — so it is never slower than getUser(). The session cookie
  // was already refreshed by the middleware (proxy.ts) earlier in this request.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return null;

  // Read the role via the service-role client so the check is independent of RLS.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single<UserRow>();

  if (error || !data) return null;
  // Super admins are admins too: both roles may use the dashboard.
  if (data.role !== "admin" && data.role !== "super_admin") return null;
  return data;
});
// Guard for dashboard pages/actions. Redirects non-admins away.
export async function requireAdmin(): Promise<UserRow> {
  const user = await getAdminUser();
  if (!user) redirect("/login");
  return user;
}

// Guard for super-admin-only actions (e.g. granting/revoking the super-admin
// role). Throws rather than redirects so server actions surface a clear error.
export async function requireSuperAdmin(): Promise<UserRow> {
  const user = await getAdminUser();
  if (!user) redirect("/login");
  if (user.role !== "super_admin") {
    throw new Error("Action réservée aux super administrateurs.");
  }
  return user;
}
