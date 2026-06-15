// Matrimonial compatibility scoring — shared types, enum scales and constants.
//
// This is a faithful TypeScript implementation of the documented 17-criterion
// matching matrix. It is intentionally framework-free and pure (no I/O), so the
// exact same logic can be unit-tested and mirrored 1:1 by the Flutter app
// (see dating_app_flutter/lib/domain/services/matching/compatibility_scorer.dart).
//
// The algorithm is asymmetric: it scores a *seeker* against a *candidate*, where
// most criteria evaluate the candidate's profile against the seeker's stated
// preferences. Age and country/relocation look at both parties. For a fully
// mutual verdict use scoreReciprocal() (see scoring.ts).

export type Priority = "hard" | "soft" | "bonus";

// ---------------------------------------------------------------------------
// Enum scales (ordinal values). Unknown / null inputs map to the lowest tier.
// ---------------------------------------------------------------------------

export const PRACTICE_SCALE: Record<string, number> = {
  non_practicing: 1,
  somewhat_practicing: 2,
  practicing: 3,
  very_practicing: 4,
};

export const EDUCATION_SCALE: Record<string, number> = {
  no_formal: 1,
  secondary: 2,
  vocational: 3,
  bachelors: 4,
  masters: 5,
  phd: 6,
};

export const QURAN_SCALE: Record<string, number> = {
  none: 0,
  basic: 1,
  recites: 2,
  memorising: 3,
  hafiz: 4,
};

export const ISLAMIC_EDUCATION_SCALE: Record<string, number> = {
  none: 0,
  self_taught: 1,
  courses: 2,
  formal: 3,
};

export const INCOME_SCALE: Record<string, number> = {
  prefer_not_to_say: 0,
  below_1k: 1,
  "1k_3k": 2,
  "3k_6k": 3,
  "6k_10k": 4,
  above_10k: 5,
};

// Timeline values are shared by the preference enum (marriage_timeline) and the
// free-text profile field (marriage_goals); unrecognised goals fall back to
// "not_sure" (the most flexible bucket) so they never hard-penalise.
export const TIMELINE_SCALE: Record<string, number> = {
  asap: 1,
  within_1_year: 2,
  "1_2_years": 3,
  "2_plus_years": 4,
  not_sure: 5,
};

// Wants-children alignment matrix, keyed `${candidate}|${seeker}`.
// Mirrors the documented matrix exactly (rows = candidate, cols = seeker).
export const WANTS_CHILDREN_MATRIX: Record<string, number> = {
  "yes|yes": 10,
  "yes|inshallah": 8,
  "yes|open": 6,
  "yes|no": -5,
  "no|no": 10,
  "no|open": 5,
  "no|inshallah": 3,
  "no|yes": -5,
  "inshallah|inshallah": 9,
  "inshallah|yes": 8,
  "inshallah|open": 7,
  "inshallah|no": 2,
  "open|open": 8,
  "open|yes": 6,
  "open|no": 5,
  "open|inshallah": 7,
};

export const HIGH_STATUS_PROFESSIONS: readonly string[] = [
  "doctor",
  "surgeon",
  "pharmacist",
  "engineer",
  "architect",
  "lawyer",
  "judge",
  "professor",
  "teacher",
  "business owner",
  "entrepreneur",
  "accountant",
  "financial advisor",
  "islamic scholar",
  "imam",
  "nurse",
  "therapist",
];

// Nationalities treated as the same broad cultural region for the small
// nationality bonus. Lower-cased for comparison.
export const ARAB_NATIONALITIES: readonly string[] = [
  "algerian",
  "bahraini",
  "comorian",
  "djiboutian",
  "egyptian",
  "iraqi",
  "jordanian",
  "kuwaiti",
  "lebanese",
  "libyan",
  "mauritanian",
  "moroccan",
  "omani",
  "palestinian",
  "qatari",
  "saudi",
  "somali",
  "sudanese",
  "syrian",
  "tunisian",
  "emirati",
  "yemeni",
];

export const BONUS_CAP = 12;
export const MAX_SCORE = 100;

// ---------------------------------------------------------------------------
// Normalised inputs. Adapters (adapters.ts) build these from raw DB rows.
// All free-text enum fields are plain strings so the engine never depends on
// the rest of the app's type surface.
// ---------------------------------------------------------------------------

export interface MatchProfileInput {
  gender: string | null;
  age: number | null;
  practiceLevel: string | null;
  maritalStatus: string | null;
  hasChildren: boolean;
  educationLevel: string | null;
  smokingStatus: string | null;
  madhhab: string | null;
  languages: string[];
  country: string | null;
  willingToRelocate: boolean; // profile flag (the person themself)
  wantsChildren: string | null; // yes | no | open | inshallah
  marriageGoals: string | null; // free text mapped onto TIMELINE_SCALE
  quranLevel: string | null;
  islamicEducationLevel: string | null;
  incomeRange: string | null;
  profession: string | null;
  heightCm: number | null;
  nationality: string | null;
}

export interface MatchPrefsInput {
  minAge: number | null;
  maxAge: number | null;
  minPracticeLevel: string | null;
  acceptedMaritalStatuses: string[]; // empty => accept all
  acceptsPartnerChildren: boolean; // true => no objection to children
  minEducationLevel: string | null; // null => no minimum
  acceptedSmokingStatuses: string[]; // empty => accept all
  acceptedMadhabs: string[]; // empty => no preference
  preferredLanguages: string[]; // empty => no preference
  sameCountryOnly: boolean;
  willingToRelocate: string | null; // no | yes_if_needed | open
  marriageTimeline: string | null;
  wantsChildren: string | null;
  // Onboarding dealbreakers. Each present value upgrades a soft criterion to a
  // hard gate (instant incompatibility):
  //   smoking | different_madhab | different_country | wont_relocate | different_language
  redFlags: string[];
  // Per-dimension importance: dimensionKey -> must_have|important|preferred|doesnt_matter.
  // Overrides the default weight of a criterion (see applyImportance in scoring.ts).
  preferenceImportance: Record<string, string>;
  // Lifestyle/personality answers (questionKey -> answer code) and how important
  // each is to the seeker. Scored by alignment between both partners' answers.
  lifestyleAnswers: Record<string, string>;
  lifestyleImportance: Record<string, string>;
}

// Importance levels chosen per dimension during onboarding.
export const IMPORTANCE = {
  mustHave: "must_have",
  important: "important",
  preferred: "preferred",
  doesntMatter: "doesnt_matter",
} as const;

// Point weights when a dimension's importance overrides its default.
export const W_IMPORTANT = 12;
export const W_PREFERRED = 4;

// Clean importance dimension key -> the scorer criterion key it controls.
export const DIMENSION_TO_CRITERION: Record<string, string> = {
  age: "age",
  practice: "practice",
  marital: "marital",
  children_has: "children_has",
  children_wants: "children_wants",
  education: "education",
  smoking: "smoking",
  madhab: "madhab",
  language: "languages",
  location: "country",
  timeline: "b_timeline",
  quran: "b_quran",
  islamic_education: "b_islamic_ed",
  income: "b_income",
  profession: "b_profession",
  height: "b_height",
  nationality: "b_nationality",
};

// Reverse lookup: criterion key -> importance dimension key.
export const CRITERION_TO_DIMENSION: Record<string, string> = Object.fromEntries(
  Object.entries(DIMENSION_TO_CRITERION).map(([dim, crit]) => [crit, dim]),
);

// Lifestyle/personality questions. Ordinal scales score by distance; categorical
// scales score exact-match. Keys are the storage keys in lifestyle_answers.
export const LIFESTYLE_QUESTIONS: Record<
  string,
  { label: string; scale: string[]; ordinal: boolean }
> = {
  family_proximity: {
    label: "Living near family",
    scale: ["comfortable", "neutral", "prefer_distance"],
    ordinal: true,
  },
  relocation: { label: "Willing to relocate", scale: ["yes", "depends", "no"], ordinal: true },
  spouse_employment: {
    label: "Spouse works or stays home",
    scale: ["works", "either", "stays_home"],
    ordinal: true,
  },
  quran_priority: {
    label: "Importance of Qur'an memorisation",
    scale: ["low", "medium", "high", "essential"],
    ordinal: true,
  },
  islamic_knowledge_priority: {
    label: "Importance of Islamic knowledge",
    scale: ["low", "medium", "high", "essential"],
    ordinal: true,
  },
  conflict_style: {
    label: "Handling disagreements",
    scale: ["discuss_calmly", "need_space", "seek_mediation"],
    ordinal: false,
  },
  financial_priority: {
    label: "Importance of financial stability",
    scale: ["low", "medium", "high", "essential"],
    ordinal: true,
  },
  household_responsibilities: {
    label: "Household responsibilities",
    scale: ["shared", "traditional", "flexible"],
    ordinal: false,
  },
  religious_practice_priority: {
    label: "Importance of family religious practice",
    scale: ["low", "medium", "high", "essential"],
    ordinal: true,
  },
  long_term_goals: {
    label: "Long-term marriage goals",
    scale: ["family_first", "career_balance", "faith_centered", "growth_travel"],
    ordinal: false,
  },
};

// Red-flag keys (mirror partner_preferences.red_flags). Keep in sync with the
// Dart mirror and the onboarding picker.
export const RED_FLAGS = {
  smoking: "smoking",
  differentMadhab: "different_madhab",
  differentCountry: "different_country",
  wontRelocate: "wont_relocate",
  differentLanguage: "different_language",
} as const;

export interface MatchParty {
  profile: MatchProfileInput;
  prefs: MatchPrefsInput;
}

export interface CriterionScore {
  key: string;
  label: string;
  priority: Priority;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface MatchResult {
  // 0..100, capped. 0 when any hard requirement fails.
  score: number;
  passedHard: boolean;
  hardFailures: string[];
  baseScore: number; // sum of criteria 1..10 before bonus
  bonusScore: number; // sum of bonus criteria, capped at BONUS_CAP
  criteria: CriterionScore[];
  rationale: string;
}

export interface ReciprocalResult {
  seekerToCandidate: MatchResult;
  candidateToSeeker: MatchResult;
  // Average of the two directional scores; 0 if either direction fails a hard gate.
  mutualScore: number;
  mutualPass: boolean;
}
