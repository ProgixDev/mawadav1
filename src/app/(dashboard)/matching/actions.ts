"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toParty } from "@/lib/matching/adapters";
import { scoreReciprocal } from "@/lib/matching/scoring";
import type { ProfileRow, PartnerPreferencesRow } from "@/lib/types/database";

// Admin introduces a ranked male+female pair by inserting a pending match
// request. Genders are resolved server-side and the mutual score is recomputed
// (never trust a number that came from the client) before insert. The DB owns
// status/expires_at defaults; a duplicate pending pair trips a unique violation
// (23505) which we surface as a friendly message.
export async function sendMatchRequest(
  seekerId: string,
  candidateId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();

  const { data: genderRows } = await admin
    .from("profiles")
    .select("user_id, gender")
    .in("user_id", [seekerId, candidateId]);

  const genderById = new Map(
    (genderRows ?? []).map((r) => [r.user_id as string, (r.gender as string | null) ?? null]),
  );
  const seekerGender = genderById.get(seekerId) ?? null;
  const candidateGender = genderById.get(candidateId) ?? null;

  let maleUserId: string | null = null;
  let femaleUserId: string | null = null;
  if (seekerGender === "male" && candidateGender === "female") {
    maleUserId = seekerId;
    femaleUserId = candidateId;
  } else if (seekerGender === "female" && candidateGender === "male") {
    maleUserId = candidateId;
    femaleUserId = seekerId;
  } else {
    return { ok: false, error: "Les deux membres doivent avoir des genres opposés et connus." };
  }

  // One-to-one exclusivity: neither person may already be in a confirmed match.
  const { data: confirmed } = await admin
    .from("matches")
    .select("male_user_id, female_user_id")
    .eq("status", "matched")
    .or(
      `male_user_id.in.(${maleUserId},${femaleUserId}),female_user_id.in.(${maleUserId},${femaleUserId})`,
    )
    .limit(1);
  if (confirmed && confirmed.length > 0) {
    return {
      ok: false,
      error: "L'un de ces membres est déjà engagé dans un jumelage confirmé.",
    };
  }

  // Recompute the mutual score server-side.
  const [
    { data: maleProfile },
    { data: malePrefs },
    { data: femaleProfile },
    { data: femalePrefs },
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", maleUserId).maybeSingle<ProfileRow>(),
    admin
      .from("partner_preferences")
      .select("*")
      .eq("user_id", maleUserId)
      .maybeSingle<PartnerPreferencesRow>(),
    admin.from("profiles").select("*").eq("user_id", femaleUserId).maybeSingle<ProfileRow>(),
    admin
      .from("partner_preferences")
      .select("*")
      .eq("user_id", femaleUserId)
      .maybeSingle<PartnerPreferencesRow>(),
  ]);

  const result = scoreReciprocal(
    toParty(maleProfile ?? null, malePrefs ?? null),
    toParty(femaleProfile ?? null, femalePrefs ?? null),
  );

  const { error } = await admin.from("matches").insert({
    male_user_id: maleUserId,
    female_user_id: femaleUserId,
    created_by: adminUser.id,
    mutual_score: Math.round(result.mutualScore),
    mutual_pass: result.mutualPass,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Une demande est déjà en attente pour cette paire." };
    }
    // Raised by the matches_enforce_exclusivity() trigger.
    if (error.code === "P0001" || /already in a confirmed match/i.test(error.message)) {
      return { ok: false, error: "L'un de ces membres est déjà engagé dans un jumelage confirmé." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/matching");
  revalidatePath("/matches");
  return { ok: true };
}

export async function cancelMatch(matchId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from("matches")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", matchId)
    .eq("status", "pending");
  revalidatePath("/matches");
}

// Dissolve a confirmed match that did not work out. Both people return to the
// pool and can be matched again (the exclusivity check only counts 'matched').
export async function endMatch(
  matchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const admin = createAdminClient();

  async function setStatus(status: "ended" | "cancelled") {
    const now = new Date().toISOString();
    return admin
      .from("matches")
      .update({
        status,
        ended_by: "admin",
        ended_at: now,
        updated_at: now,
      })
      .eq("id", matchId)
      .eq("status", "matched")
      .select("id");
  }

  let { data, error } = await setStatus("ended");

  // Fallback: if the status CHECK constraint still lacks 'ended' (the updated
  // matching_requests.sql hasn't been re-run yet), dissolve via 'cancelled',
  // which is always allowed. Either way both users leave the 'matched' set and
  // become available again.
  if (error && (error.code === "23514" || /check constraint/i.test(error.message))) {
    ({ data, error } = await setStatus("cancelled"));
  }

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Le jumelage n'est pas dans un état confirmé." };
  }

  revalidatePath("/matches");
  revalidatePath("/matching");
  return { ok: true };
}
