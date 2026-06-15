// Human-readable labels for partner-preference data surfaced in the admin UI.
// Display-only — the matching engine keys off the raw codes.

export const DIMENSION_LABELS: Record<string, string> = {
  age: "Age",
  practice: "Religiosity",
  marital: "Marital status",
  children_has: "Has children",
  children_wants: "Wants children",
  education: "Education",
  smoking: "Smoking",
  madhab: "Madhab",
  language: "Language",
  location: "Country / mobility",
  timeline: "Marriage timeline",
  quran: "Qur'an level",
  islamic_education: "Islamic education",
  income: "Income",
  profession: "Profession",
  height: "Height",
  nationality: "Nationality",
};

export const IMPORTANCE_LABELS: Record<string, string> = {
  must_have: "Must have",
  important: "Important",
  preferred: "Preferred",
  doesnt_matter: "Doesn't matter",
};

export const LIFESTYLE_LABELS: Record<string, string> = {
  family_proximity: "Living near family",
  relocation: "Willing to relocate",
  spouse_employment: "Spouse works / stays home",
  quran_priority: "Qur'an memorisation priority",
  islamic_knowledge_priority: "Islamic knowledge priority",
  conflict_style: "Conflict handling",
  financial_priority: "Financial stability priority",
  household_responsibilities: "Household responsibilities",
  religious_practice_priority: "Family religious practice priority",
  long_term_goals: "Long-term goals",
};

const PRIORITY_ANSWERS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  essential: "Essential",
};

export const LIFESTYLE_ANSWER_LABELS: Record<string, Record<string, string>> = {
  family_proximity: {
    comfortable: "Comfortable",
    neutral: "Neutral",
    prefer_distance: "Prefers distance",
  },
  relocation: {
    yes: "Yes",
    depends: "Depends",
    no: "No",
  },
  spouse_employment: {
    works: "Works",
    either: "Either",
    stays_home: "Stays home",
  },
  quran_priority: PRIORITY_ANSWERS,
  islamic_knowledge_priority: PRIORITY_ANSWERS,
  financial_priority: PRIORITY_ANSWERS,
  religious_practice_priority: PRIORITY_ANSWERS,
  conflict_style: {
    discuss_calmly: "Discuss calmly",
    need_space: "Needs space",
    seek_mediation: "Seeks mediation",
  },
  household_responsibilities: {
    shared: "Shared",
    traditional: "Traditional",
    flexible: "Flexible",
  },
  long_term_goals: {
    family_first: "Family first",
    career_balance: "Career balance",
    faith_centered: "Faith-centered",
    growth_travel: "Growth & travel",
  },
};
