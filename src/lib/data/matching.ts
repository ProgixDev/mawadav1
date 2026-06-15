import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fullName, age } from "@/lib/format";
import { toParty } from "@/lib/matching/adapters";
import { scoreReciprocal, type ReciprocalResult } from "@/lib/matching/scoring";
import type {
  ProfileRow,
  PartnerPreferencesRow,
  MatchRow,
  MatchStatus,
} from "@/lib/types/database";

export interface MatchableMember {
  userId: string;
  name: string;
  gender: string | null;
  age: number | null;
  city: string | null;
  country: string | null;
}

export interface RankedCandidate extends MatchableMember {
  result: ReciprocalResult;
}

function oppositeGender(g: string | null): string | null {
  if (g === "male") return "female";
  if (g === "female") return "male";
  return null;
}

function memberFromProfile(userId: string, p: ProfileRow | null): MatchableMember {
  return {
    userId,
    name: fullName(p?.first_name, p?.last_name),
    gender: p?.gender ?? null,
    age: age(p?.birthdate ?? null),
    city: p?.city ?? null,
    country: p?.country ?? null,
  };
}

// Active members that have a profile — the pool an admin can run matching for.
export async function listMatchableMembers(): Promise<MatchableMember[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, status, profiles!inner(first_name, last_name, gender, city, country, birthdate)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as ProfileRow | null;
    return memberFromProfile(row.id, profile);
  });
}

interface MemberBundle {
  member: MatchableMember;
  profile: ProfileRow | null;
  prefs: PartnerPreferencesRow | null;
}

async function loadBundle(userId: string): Promise<MemberBundle | null> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", userId).maybeSingle<ProfileRow>(),
    admin
      .from("partner_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<PartnerPreferencesRow>(),
  ]);
  if (!profile) return null;
  return { member: memberFromProfile(userId, profile), profile, prefs: prefs ?? null };
}

// Score every eligible (active, opposite-gender) candidate against a member and
// return them ranked by mutual compatibility. Candidates failing a hard gate
// sort last but are still returned so the admin sees why.
export async function rankCandidatesFor(memberId: string): Promise<{
  member: MatchableMember | null;
  candidates: RankedCandidate[];
}> {
  const admin = createAdminClient();
  const seeker = await loadBundle(memberId);
  if (!seeker) return { member: null, candidates: [] };

  const want = oppositeGender(seeker.member.gender);

  // Pull the candidate profile pool in one query, then their prefs in one more.
  let profileQuery = admin.from("profiles").select("*").neq("user_id", memberId);
  if (want) profileQuery = profileQuery.eq("gender", want);
  const { data: profileRows } = await profileQuery;
  const profiles = (profileRows ?? []) as ProfileRow[];

  const candidateIds = profiles.map((p) => p.user_id);
  if (candidateIds.length === 0) return { member: seeker.member, candidates: [] };

  const [{ data: activeUsers }, { data: prefRows }] = await Promise.all([
    admin.from("users").select("id").eq("status", "active").in("id", candidateIds),
    admin.from("partner_preferences").select("*").in("user_id", candidateIds),
  ]);

  const activeSet = new Set((activeUsers ?? []).map((u) => u.id as string));
  const prefsByUser = new Map<string, PartnerPreferencesRow>();
  for (const pr of (prefRows ?? []) as PartnerPreferencesRow[]) prefsByUser.set(pr.user_id, pr);

  const seekerParty = toParty(seeker.profile, seeker.prefs);

  const candidates: RankedCandidate[] = profiles
    .filter((p) => activeSet.has(p.user_id))
    .map((p) => {
      const prefs = prefsByUser.get(p.user_id) ?? null;
      const result = scoreReciprocal(seekerParty, toParty(p, prefs));
      return { ...memberFromProfile(p.user_id, p), result };
    })
    .sort((a, b) => {
      // passing hard gates first, then by mutual score desc
      if (a.result.mutualPass !== b.result.mutualPass) return a.result.mutualPass ? -1 : 1;
      return b.result.mutualScore - a.result.mutualScore;
    });

  return { member: seeker.member, candidates };
}

// Live (non-cancelled, non-expired) match statuses for a seeker, keyed by the
// *other* participant's id. Powers the per-candidate badge on the matching page.
export async function existingMatchStatusFor(
  seekerId: string,
): Promise<Map<string, MatchStatus>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("matches")
    .select("male_user_id, female_user_id, status")
    .or(`male_user_id.eq.${seekerId},female_user_id.eq.${seekerId}`)
    .not("status", "in", "(cancelled,expired,ended)");

  const byCandidate = new Map<string, MatchStatus>();
  for (const m of (data ?? []) as Pick<MatchRow, "male_user_id" | "female_user_id" | "status">[]) {
    const other = m.male_user_id === seekerId ? m.female_user_id : m.male_user_id;
    byCandidate.set(other, m.status);
  }
  return byCandidate;
}

// Every user currently in a confirmed ('matched') one-to-one relationship.
// Such users are exclusive and cannot receive any new match request.
export async function matchedUserIds(): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("matches")
    .select("male_user_id, female_user_id")
    .eq("status", "matched");

  const ids = new Set<string>();
  for (const m of (data ?? []) as Pick<MatchRow, "male_user_id" | "female_user_id">[]) {
    ids.add(m.male_user_id);
    ids.add(m.female_user_id);
  }
  return ids;
}

export interface MatchListItem extends MatchRow {
  maleName: string;
  maleEmail: string;
  femaleName: string;
  femaleEmail: string;
}

// All match requests, newest first, optionally filtered by status. Mirrors the
// listConversations() shape: one query for the rows, then batched joins for the
// participant profiles + emails.
export async function listMatches(status?: string): Promise<MatchListItem[]> {
  const admin = createAdminClient();

  let q = admin
    .from("matches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") q = q.eq("status", status);

  const { data } = await q;
  const matches = (data ?? []) as MatchRow[];
  if (matches.length === 0) return [];

  const userIds = Array.from(
    new Set(matches.flatMap((m) => [m.male_user_id, m.female_user_id])),
  );

  const [{ data: users }, { data: profiles }] = await Promise.all([
    admin.from("users").select("id, email").in("id", userIds),
    admin.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds),
  ]);

  const emailById = new Map((users ?? []).map((u) => [u.id as string, u.email as string]));
  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.user_id as string,
      p as Pick<ProfileRow, "first_name" | "last_name" | "user_id">,
    ]),
  );

  return matches.map((m) => {
    const male = profileById.get(m.male_user_id);
    const female = profileById.get(m.female_user_id);
    return {
      ...m,
      maleName: fullName(male?.first_name, male?.last_name),
      maleEmail: emailById.get(m.male_user_id) ?? "",
      femaleName: fullName(female?.first_name, female?.last_name),
      femaleEmail: emailById.get(m.female_user_id) ?? "",
    };
  });
}
