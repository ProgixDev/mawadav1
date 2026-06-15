import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  UserRow,
  ProfileRow,
  MahramRow,
  PartnerPreferencesRow,
  UserWithProfile,
} from "@/lib/types/database";

const PAGE_SIZE = 25;

export interface UserListItem extends UserRow {
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  city: string | null;
  country: string | null;
}

export async function listUsers(opts: {
  search?: string;
  status?: string;
  page?: number;
}): Promise<{ items: UserListItem[]; total: number; page: number; pageSize: number }> {
  const admin = createAdminClient();
  const page = Math.max(1, opts.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = admin
    .from("users")
    .select("*, profiles(first_name, last_name, gender, city, country)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (opts.status && opts.status !== "all") {
    query = query.eq("status", opts.status);
  }
  if (opts.search) {
    query = query.ilike("email", `%${opts.search}%`);
  }

  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  const items: UserListItem[] = (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      role: row.role,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      gender: profile?.gender ?? null,
      city: profile?.city ?? null,
      country: profile?.country ?? null,
    };
  });

  return { items, total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getUserDetail(id: string): Promise<UserWithProfile | null> {
  const admin = createAdminClient();

  const { data: user, error } = await admin
    .from("users")
    .select("*")
    .eq("id", id)
    .single<UserRow>();
  if (error || !user) return null;

  const [{ data: profile }, { data: mahram }, { data: prefs }] = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", id).maybeSingle<ProfileRow>(),
    admin.from("mahrams").select("*").eq("female_user_id", id).maybeSingle<MahramRow>(),
    admin
      .from("partner_preferences")
      .select("*")
      .eq("user_id", id)
      .maybeSingle<PartnerPreferencesRow>(),
  ]);

  return {
    ...user,
    profile: profile ?? null,
    mahram: mahram ?? null,
    partner_preferences: prefs ?? null,
  };
}
