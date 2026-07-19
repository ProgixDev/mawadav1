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

// Prayer habit (religious criterion). Ordinal: closeness scores compatibility.
export const PRAYER_SCALE: Record<string, number> = {
  never: 1,
  sometimes: 2,
  regularly: 3,
};

export const QURAN_SCALE: Record<string, number> = {
  none: 0,
  basic: 1,
  recites: 2,
  memorising: 3,
  hafiz: 4,
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
  prayerFrequency: string | null; // never | sometimes | regularly
  wearsHijab: boolean | null; // female profiles only
  maritalStatus: string | null;
  hasChildren: boolean;
  educationLevel: string | null;
  smokingStatus: string | null;
  madhhab: string | null;
  languages: string[];
  country: string | null;
  willingToRelocate: boolean; // profile flag (the person themself)
  wantsChildren: string | null; // yes | no | open | inshallah
  quranLevel: string | null;
  profession: string | null;
  heightCm: number | null;
}

export interface MatchPrefsInput {
  minAge: number | null;
  maxAge: number | null;
  acceptsPartnerChildren: boolean; // true => no objection to children
  acceptedSmokingStatuses: string[]; // empty => accept all
  preferredLanguages: string[]; // empty => no preference
  sameCountryOnly: boolean;
  willingToRelocate: string | null; // no | yes_if_needed | open
  wantsChildren: string | null;
  // Onboarding dealbreakers. Each present value upgrades a soft criterion to a
  // hard gate (instant incompatibility):
  //   smoking | no_children | different_country | wont_relocate | different_language
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
  prayer: "prayer",
  hijab: "hijab",
  children_has: "children_has",
  children_wants: "children_wants",
  smoking: "smoking",
  language: "languages",
  location: "country",
  quran: "b_quran",
  profession: "b_profession",
  height: "b_height",
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
    label: "Habiter près de la famille",
    scale: ["comfortable", "neutral", "prefer_distance"],
    ordinal: true,
  },
  relocation: { label: "Prêt à déménager", scale: ["yes", "depends", "no"], ordinal: true },
  spouse_employment: {
    label: "Conjoint travaille / reste à la maison",
    scale: ["works", "either", "stays_home"],
    ordinal: true,
  },
  quran_priority: {
    label: "Priorité à la mémorisation du Coran",
    scale: ["low", "medium", "high", "essential"],
    ordinal: true,
  },
  islamic_knowledge_priority: {
    label: "Priorité au savoir islamique",
    scale: ["low", "medium", "high", "essential"],
    ordinal: true,
  },
  conflict_style: {
    label: "Gestion des conflits",
    scale: ["discuss_calmly", "need_space", "seek_mediation"],
    ordinal: false,
  },
  financial_priority: {
    label: "Priorité à la stabilité financière",
    scale: ["low", "medium", "high", "essential"],
    ordinal: true,
  },
  household_responsibilities: {
    label: "Responsabilités domestiques",
    scale: ["shared", "traditional", "flexible"],
    ordinal: false,
  },
  religious_practice_priority: {
    label: "Priorité à la pratique religieuse familiale",
    scale: ["low", "medium", "high", "essential"],
    ordinal: true,
  },
  long_term_goals: {
    label: "Objectifs à long terme",
    scale: ["family_first", "career_balance", "faith_centered", "growth_travel"],
    ordinal: false,
  },
};

// Red-flag keys (mirror partner_preferences.red_flags). Keep in sync with the
// Dart mirror and the onboarding picker.
export const RED_FLAGS = {
  smoking: "smoking",
  noChildren: "no_children",
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
