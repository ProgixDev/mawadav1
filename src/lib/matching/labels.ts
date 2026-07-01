// Human-readable labels for partner-preference data surfaced in the admin UI.
// Display-only — the matching engine keys off the raw codes.

export const DIMENSION_LABELS: Record<string, string> = {
  age: "Âge",
  practice: "Religiosité",
  prayer: "Prière",
  hijab: "Hijab",
  marital: "État civil",
  children_has: "A des enfants",
  children_wants: "Souhaite des enfants",
  education: "Éducation",
  smoking: "Tabagisme",
  madhab: "Madhab",
  language: "Langue",
  location: "Pays / mobilité",
  timeline: "Échéancier de mariage",
  quran: "Niveau de Coran",
  islamic_education: "Éducation islamique",
  income: "Revenu",
  profession: "Profession",
  height: "Taille",
  nationality: "Nationalité",
};

export const ROLE_LABELS: Record<string, string> = {
  user: "Membre",
  admin: "Administrateur",
  super_admin: "Super administrateur",
  mahram: "Mahram (tuteur)",
};

export const PRAYER_LABELS: Record<string, string> = {
  regularly: "Oui, je prie régulièrement",
  sometimes: "Je prie mais pas régulièrement",
  never: "Non, je ne prie pas",
};

export const MAHRAM_STATUS_LABELS: Record<string, string> = {
  pending: "En attente d’approbation du mahram",
  approved: "Approuvé",
  rejected: "Rejeté",
};

export const IMPORTANCE_LABELS: Record<string, string> = {
  must_have: "Indispensable",
  important: "Important",
  preferred: "Préféré",
  doesnt_matter: "Sans importance",
};

export const LIFESTYLE_LABELS: Record<string, string> = {
  family_proximity: "Habiter près de la famille",
  relocation: "Prêt à déménager",
  spouse_employment: "Conjoint travaille / reste à la maison",
  quran_priority: "Priorité à la mémorisation du Coran",
  islamic_knowledge_priority: "Priorité au savoir islamique",
  conflict_style: "Gestion des conflits",
  financial_priority: "Priorité à la stabilité financière",
  household_responsibilities: "Responsabilités domestiques",
  religious_practice_priority: "Priorité à la pratique religieuse familiale",
  long_term_goals: "Objectifs à long terme",
};

const PRIORITY_ANSWERS: Record<string, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Élevée",
  essential: "Essentielle",
};

export const LIFESTYLE_ANSWER_LABELS: Record<string, Record<string, string>> = {
  family_proximity: {
    comfortable: "À l’aise",
    neutral: "Neutre",
    prefer_distance: "Préfère la distance",
  },
  relocation: {
    yes: "Oui",
    depends: "Cela dépend",
    no: "Non",
  },
  spouse_employment: {
    works: "Travaille",
    either: "Indifférent",
    stays_home: "Reste à la maison",
  },
  quran_priority: PRIORITY_ANSWERS,
  islamic_knowledge_priority: PRIORITY_ANSWERS,
  financial_priority: PRIORITY_ANSWERS,
  religious_practice_priority: PRIORITY_ANSWERS,
  conflict_style: {
    discuss_calmly: "Discuter calmement",
    need_space: "A besoin d’espace",
    seek_mediation: "Cherche une médiation",
  },
  household_responsibilities: {
    shared: "Partagées",
    traditional: "Traditionnelles",
    flexible: "Flexibles",
  },
  long_term_goals: {
    family_first: "La famille d’abord",
    career_balance: "Équilibre de carrière",
    faith_centered: "Centré sur la foi",
    growth_travel: "Épanouissement et voyages",
  },
};
