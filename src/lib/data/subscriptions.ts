import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionRow } from "@/lib/types/database";

export interface SubscriptionItem extends SubscriptionRow {
  userEmail: string | null;
}

export async function listSubscriptions(status?: string): Promise<SubscriptionItem[]> {
  const admin = createAdminClient();
  let q = admin
    .from("subscriptions")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") q = q.eq("status", status);

  const { data } = await q;
  const rows = (data ?? []) as SubscriptionRow[];
  if (rows.length === 0) return [];

  const ids = Array.from(new Set(rows.map((s) => s.user_id)));
  const { data: users } = await admin.from("users").select("id, email").in("id", ids);
  const emailById = new Map((users ?? []).map((u) => [u.id, u.email as string]));

  return rows.map((s) => ({ ...s, userEmail: emailById.get(s.user_id) ?? null }));
}
