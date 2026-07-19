// Map raw Supabase rows onto the normalised matching inputs.
//
// The live `partner_preferences` table currently exposes only 5 of the columns
// the algorithm can use (min_age, max_age, wants_children, min_practice_level,
// willing_to_relocate). The richer whitelist columns (accepted_marital_statuses,
// accepts_partner_children, min_education_level, accepted_smoking_statuses,
// accepted_madhabs, preferred_languages, same_country_only) are added by the
// migration in supabase/partner_preferences_matching_columns.sql.
//
// Until those columns exist we read them defensively and fall back to
// *permissive* defaults — i.e. "no preference / no hard reject" — exactly the
// graceful degradation the matrix specifies for empty arrays. As soon as the
// columns are populated the corresponding criteria activate with no code change.
//
// Some profile/preference columns the matrix originally scored (income_range,
// nationality, islamic_education_level, marriage_goals/marriage_timeline) have
// no onboarding UI anywhere in the app to ever set them, so those four bonus
// criteria were removed entirely rather than always scoring a dead 0 — see
// scoring.ts. The columns themselves are untouched (still shown as raw profile
// fields on the admin user detail page) in case they're collected later.

import { age } from "@/lib/format";
import type { ProfileRow, PartnerPreferencesRow } from "@/lib/types/database";
import type { MatchParty, MatchPrefsInput, MatchProfileInput } from "./types";

// partner_preferences may carry columns not yet in the typed interface.
type LooseRow = Record<string, unknown>;

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

function asStringMap(v: unknown): Record<string, string> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string") out[k] = val;
    }
    return out;
  }
  return {};
}

// profile.wants_children is stored as text ('yes'|'no'|'open'|'inshallah') by the
// mobile app even though the generated TS type currently says boolean — coerce
// both shapes so the engine always sees the enum string.
function coerceWantsChildren(v: unknown): string | null {
  if (typeof v === "string") return v.trim() === "" ? null : v;
  if (typeof v === "boolean") return v ? "yes" : "no";
  return null;
}

// prefs.willing_to_relocate is the enum 'no'|'yes_if_needed'|'open' as written by
// the mobile app, though the generated TS type currently says boolean — coerce both.
function coerceRelocatePref(v: unknown): string | null {
  if (typeof v === "string") return v.trim() === "" ? null : v;
  if (typeof v === "boolean") return v ? "open" : "no";
  return null;
}

export function toProfileInput(p: ProfileRow | null): MatchProfileInput {
  return {
    gender: p?.gender ?? null,
    age: age(p?.birthdate ?? null),
    practiceLevel: p?.practice_level ?? null,
    prayerFrequency: p?.prayer_frequency ?? null,
    wearsHijab: p?.wears_hijab ?? null,
    maritalStatus: p?.marital_status ?? null,
    hasChildren: p?.has_children ?? false,
    educationLevel: p?.education_level ?? null,
    smokingStatus: p?.smoking_status ?? null,
    madhhab: p?.madhhab ?? null,
    languages: p?.languages ?? [],
    country: p?.country ?? null,
    willingToRelocate: p?.willing_to_relocate ?? false,
    wantsChildren: coerceWantsChildren(p?.wants_children),
    quranLevel: p?.quran_level ?? null,
    profession: p?.profession ?? null,
    heightCm: p?.height_cm ?? null,
  };
}

export function toPrefsInput(pref: PartnerPreferencesRow | null): MatchPrefsInput {
  const row = (pref ?? {}) as LooseRow;
  return {
    minAge: pref?.min_age ?? null,
    maxAge: pref?.max_age ?? null,
    // Optional whitelist columns — permissive defaults until populated.
    acceptsPartnerChildren:
      typeof row["accepts_partner_children"] === "boolean"
        ? (row["accepts_partner_children"] as boolean)
        : true,
    acceptedSmokingStatuses: asStringArray(row["accepted_smoking_statuses"]),
    preferredLanguages: asStringArray(row["preferred_languages"]),
    sameCountryOnly:
      typeof row["same_country_only"] === "boolean" ? (row["same_country_only"] as boolean) : false,
    willingToRelocate: coerceRelocatePref(row["willing_to_relocate"]),
    wantsChildren: coerceWantsChildren(pref?.wants_children),
    redFlags: asStringArray(row["red_flags"]),
    preferenceImportance: asStringMap(row["preference_importance"]),
    lifestyleAnswers: asStringMap(row["lifestyle_answers"]),
    lifestyleImportance: asStringMap(row["lifestyle_importance"]),
  };
}

export function toParty(
  profile: ProfileRow | null,
  prefs: PartnerPreferencesRow | null,
): MatchParty {
  return { profile: toProfileInput(profile), prefs: toPrefsInput(prefs) };
}
