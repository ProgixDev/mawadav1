import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserStatus, SubscriptionStatus, AdminStatus } from "@/lib/types/database";

async function countWhere(
  table: string,
  column?: string,
  value?: string,
): Promise<number> {
  const admin = createAdminClient();
  let query = admin.from(table).select("*", { count: "exact", head: true });
  if (column && value !== undefined) query = query.eq(column, value);
  const { count } = await query;
  return count ?? 0;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  onboardingUsers: number;
  suspendedUsers: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  totalConversations: number;
  openConversations: number;
  usersByStatus: { name: string; value: number }[];
  subscriptionsByStatus: { name: string; value: number }[];
  conversationsByAdminStatus: { name: string; value: number }[];
  genderSplit: { name: string; value: number }[];
  signupsByDay: { date: string; count: number }[];
}

async function computeDashboardStats(): Promise<DashboardStats> {
  const admin = createAdminClient();

  const [
    totalUsers,
    activeUsers,
    onboardingUsers,
    suspendedUsers,
    deletedUsers,
    activeSubscriptions,
    trialSubscriptions,
    expiredSubscriptions,
    canceledSubscriptions,
    totalConversations,
    newConversations,
    inContactConversations,
    pausedConversations,
  ] = await Promise.all([
    countWhere("users"),
    countWhere("users", "status", "active"),
    countWhere("users", "status", "onboarding"),
    countWhere("users", "status", "suspended"),
    countWhere("users", "status", "deleted"),
    countWhere("subscriptions", "status", "active"),
    countWhere("subscriptions", "status", "trial"),
    countWhere("subscriptions", "status", "expired"),
    countWhere("subscriptions", "status", "canceled"),
    countWhere("conversations"),
    countWhere("conversations", "admin_status", "new"),
    countWhere("conversations", "admin_status", "in_contact"),
    countWhere("conversations", "admin_status", "paused"),
  ]);

  // Gender split from profiles.
  const { data: genderRows } = await admin.from("profiles").select("gender");
  const genderCounts = new Map<string, number>();
  for (const r of genderRows ?? []) {
    const g = (r.gender as string | null)?.toLowerCase() || "unspecified";
    genderCounts.set(g, (genderCounts.get(g) ?? 0) + 1);
  }

  // Signups over the last 14 days.
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);
  const { data: recentUsers } = await admin
    .from("users")
    .select("created_at")
    .gte("created_at", since.toISOString());

  const dayMap = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const u of recentUsers ?? []) {
    const key = String(u.created_at).slice(0, 10);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  }

  const statusLabel: Record<UserStatus, string> = {
    onboarding: "Onboarding",
    active: "Active",
    suspended: "Suspended",
    deleted: "Deleted",
  };
  const subLabel: Record<SubscriptionStatus, string> = {
    active: "Active",
    trial: "Trial",
    expired: "Expired",
    canceled: "Canceled",
  };
  const convLabel: Record<AdminStatus, string> = {
    new: "New",
    in_contact: "In contact",
    paused: "Paused",
  };

  return {
    totalUsers,
    activeUsers,
    onboardingUsers,
    suspendedUsers,
    activeSubscriptions,
    trialSubscriptions,
    totalConversations,
    openConversations: newConversations,
    usersByStatus: [
      { name: statusLabel.active, value: activeUsers },
      { name: statusLabel.onboarding, value: onboardingUsers },
      { name: statusLabel.suspended, value: suspendedUsers },
      { name: statusLabel.deleted, value: deletedUsers },
    ],
    subscriptionsByStatus: [
      { name: subLabel.active, value: activeSubscriptions },
      { name: subLabel.trial, value: trialSubscriptions },
      { name: subLabel.expired, value: expiredSubscriptions },
      { name: subLabel.canceled, value: canceledSubscriptions },
    ],
    conversationsByAdminStatus: [
      { name: convLabel.new, value: newConversations },
      { name: convLabel.in_contact, value: inContactConversations },
      { name: convLabel.paused, value: pausedConversations },
    ],
    genderSplit: Array.from(genderCounts.entries()).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    })),
    signupsByDay: Array.from(dayMap.entries()).map(([date, count]) => ({
      date: date.slice(5),
      count,
    })),
  };
}

// Stats are platform-wide (not per-user) and don't need to be real-time, so we
// cache the whole result for 60s. Repeat visits to the Overview then serve from
// cache instead of re-running ~15 Supabase queries on every navigation.
export const getDashboardStats = unstable_cache(
  computeDashboardStats,
  ["dashboard-stats"],
  { revalidate: 60 },
);
