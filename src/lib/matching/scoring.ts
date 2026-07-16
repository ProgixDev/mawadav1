// Pure matrimonial compatibility scoring engine.
//
// scoreMatch(seeker, candidate) evaluates the candidate against the seeker's
// preferences, faithfully following the documented 17-criterion matrix. No I/O.
// Keep this file behaviourally identical to the Dart mirror in
// dating_app_flutter/lib/domain/services/matching/compatibility_scorer.dart.

import {
  ARAB_NATIONALITIES,
  BONUS_CAP,
  CRITERION_TO_DIMENSION,
  EDUCATION_SCALE,
  HIGH_STATUS_PROFESSIONS,
  IMPORTANCE,
  INCOME_SCALE,
  ISLAMIC_EDUCATION_SCALE,
  LIFESTYLE_QUESTIONS,
  MAX_SCORE,
  PRACTICE_SCALE,
  PRAYER_SCALE,
  RED_FLAGS,
  TIMELINE_SCALE,
  WANTS_CHILDREN_MATRIX,
  W_IMPORTANT,
  W_PREFERRED,
  type CriterionScore,
  type MatchParty,
  type MatchResult,
  type ReciprocalResult,
} from "./types";
import { PRAYER_LABELS } from "./labels";

export type { MatchResult, ReciprocalResult } from "./types";

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function hasRedFlag(party: MatchParty, flag: string): boolean {
  return party.prefs.redFlags.map(norm).includes(flag);
}

function scaleValue(scale: Record<string, number>, v: string | null | undefined): number | null {
  const key = norm(v);
  if (!key) return null;
  return key in scale ? scale[key] : null;
}

// ---------------------------------------------------------------------------
// Individual criteria. Each returns a CriterionScore; hard gate failures are
// reported back to scoreMatch via the `hardFail` flag embedded in the detail.
// ---------------------------------------------------------------------------

interface Scored {
  criterion: CriterionScore;
  hardFail?: string; // reason, when a hard gate is tripped
}

// Opposite-gender is a hard requirement: this is a matrimonial app, so a
// same-gender pairing is never a valid match. Weightless gate (maxPoints 0) —
// it cannot add points, only fail the match. When a gender is unknown we stay
// permissive (gender is collected at onboarding, so this only affects partial
// test fixtures), matching how the other criteria treat missing data.
function genderGate(party: MatchParty, candidate: MatchParty): Scored {
  const a = norm(party.profile.gender);
  const b = norm(candidate.profile.gender);
  if (a && b && a === b) {
    return {
      criterion: {
        key: "gender",
        label: "Genre",
        priority: "hard",
        points: 0,
        maxPoints: 0,
        detail: "Même genre — jumelage invalide",
      },
      hardFail: "Jumelage de même genre",
    };
  }
  return {
    criterion: {
      key: "gender",
      label: "Genre",
      priority: "hard",
      points: 0,
      maxPoints: 0,
      detail: a && b ? "Genres opposés" : "Genre non renseigné",
    },
  };
}

function age(party: MatchParty, candidate: MatchParty): Scored {
  const candAge = candidate.profile.age;
  const seekerAge = party.profile.age;
  const candInSeeker =
    candAge != null &&
    candAge >= (party.prefs.minAge ?? 0) &&
    candAge <= (party.prefs.maxAge ?? 200);
  const seekerInCand =
    seekerAge != null &&
    seekerAge >= (candidate.prefs.minAge ?? 0) &&
    seekerAge <= (candidate.prefs.maxAge ?? 200);

  let points = 0;
  let hardFail: string | undefined;
  if (candInSeeker && seekerInCand) points = 15;
  else if (candInSeeker || seekerInCand) points = 5;
  else hardFail = "Âge hors des tranches acceptées des deux côtés";

  return {
    criterion: {
      key: "age",
      label: "Âge",
      priority: "hard",
      points,
      maxPoints: 15,
      detail:
        hardFail ??
        `Candidat ${candAge ?? "?"} / demandeur ${seekerAge ?? "?"} — ${
          candInSeeker && seekerInCand ? "les deux tranches respectées" : "un seul sens respecté"
        }`,
    },
    hardFail,
  };
}

function practice(party: MatchParty, candidate: MatchParty): Scored {
  const min = scaleValue(PRACTICE_SCALE, party.prefs.minPracticeLevel);
  if (min == null) {
    return ok("practice", "Religiosité", "hard", 12, "Aucun minimum requis");
  }
  const cand = scaleValue(PRACTICE_SCALE, candidate.profile.practiceLevel) ?? 0;
  if (cand >= min) {
    return ok("practice", "Religiosité", "hard", 12, `Atteint le minimum requis (${candidate.profile.practiceLevel})`);
  }
  return hard("practice", "Religiosité", 12, `En dessous du niveau de pratique minimum (${party.prefs.minPracticeLevel})`);
}

// Prayer compatibility (religious criterion, significant weight). Scored only
// when BOTH partners stated a prayer habit — otherwise neutral (0/0), so it
// never penalises profiles created before this field existed. Closer prayer
// habits score higher; a regular-vs-never gap scores nothing.
function prayer(party: MatchParty, candidate: MatchParty): Scored {
  const seeker = scaleValue(PRAYER_SCALE, party.profile.prayerFrequency);
  const cand = scaleValue(PRAYER_SCALE, candidate.profile.prayerFrequency);
  if (seeker == null || cand == null) {
    return { criterion: { key: "prayer", label: "Prière", priority: "soft", points: 0, maxPoints: 0, detail: "Non renseigné" } };
  }
  const diff = Math.abs(seeker - cand);
  const pts = diff === 0 ? 12 : diff === 1 ? 6 : 0;
  const candLabel = PRAYER_LABELS[candidate.profile.prayerFrequency ?? ""] ?? candidate.profile.prayerFrequency;
  const seekerLabel = PRAYER_LABELS[party.profile.prayerFrequency ?? ""] ?? party.profile.prayerFrequency;
  return soft("prayer", "Prière", 12, pts, `${candLabel} vs ${seekerLabel}`);
}

// Hijab (religious criterion). Only meaningful when the CANDIDATE is a woman who
// stated whether she wears the hijab — otherwise neutral (0/0). Wearing the
// hijab scores full; not wearing scores partial. A seeker who marks hijab as
// important / must-have escalates this via the importance system.
function hijab(_party: MatchParty, candidate: MatchParty): Scored {
  if (norm(candidate.profile.gender) !== "female" || candidate.profile.wearsHijab == null) {
    return { criterion: { key: "hijab", label: "Hijab", priority: "soft", points: 0, maxPoints: 0, detail: "Non applicable" } };
  }
  return candidate.profile.wearsHijab
    ? soft("hijab", "Hijab", 8, 8, "Porte le hijab")
    : soft("hijab", "Hijab", 8, 3, "Ne porte pas le hijab");
}

function maritalStatus(party: MatchParty, candidate: MatchParty): Scored {
  const accepted = party.prefs.acceptedMaritalStatuses.map(norm);
  if (accepted.length === 0) {
    return ok("marital", "État civil", "hard", 12, "Aucune restriction");
  }
  if (accepted.includes(norm(candidate.profile.maritalStatus))) {
    return ok("marital", "État civil", "hard", 12, `Accepté (${candidate.profile.maritalStatus})`);
  }
  return hard("marital", "État civil", 12, `État civil non accepté (${candidate.profile.maritalStatus})`);
}

function hasChildren(party: MatchParty, candidate: MatchParty): Scored {
  if (candidate.profile.hasChildren && !party.prefs.acceptsPartnerChildren) {
    return hard("children_has", "A des enfants", 10, "Le candidat a des enfants ; le demandeur ne l'accepte pas");
  }
  return ok(
    "children_has",
    "A des enfants",
    "hard",
    10,
    candidate.profile.hasChildren ? "A des enfants — accepté" : "N'a pas d'enfants",
  );
}

function wantsChildren(party: MatchParty, candidate: MatchParty): Scored {
  const cand = norm(candidate.profile.wantsChildren);
  const seeker = norm(party.profile.wantsChildren);
  if (!cand || !seeker) {
    return soft("children_wants", "Souhaite des enfants", 10, 0, "Données insuffisantes");
  }
  const pts = WANTS_CHILDREN_MATRIX[`${cand}|${seeker}`] ?? 0;
  return soft("children_wants", "Souhaite des enfants", 10, pts, `${cand} vs ${seeker}`);
}

function education(party: MatchParty, candidate: MatchParty): Scored {
  const min = scaleValue(EDUCATION_SCALE, party.prefs.minEducationLevel);
  if (min == null) {
    return soft("education", "Éducation", 10, 10, "Aucun minimum requis");
  }
  const cand = scaleValue(EDUCATION_SCALE, candidate.profile.educationLevel) ?? 0;
  if (cand >= min) return soft("education", "Éducation", 10, 10, "Atteint ou dépasse le minimum requis");
  if (cand === min - 1) return soft("education", "Éducation", 10, 5, "Un niveau en dessous du minimum requis");
  return soft("education", "Éducation", 10, 0, "Deux niveaux ou plus en dessous du minimum requis");
}

function smoking(party: MatchParty, candidate: MatchParty): Scored {
  const accepted = party.prefs.acceptedSmokingStatuses.map(norm);
  const cand = norm(candidate.profile.smokingStatus);

  // Red flag: an active smoker (occasionally|regularly) is an instant dealbreaker.
  if (hasRedFlag(party, RED_FLAGS.smoking) && (cand === "occasionally" || cand === "regularly")) {
    return hard("smoking", "Tabagisme", 8, "Rédhibitoire : le demandeur rejette les fumeurs");
  }

  if (accepted.length === 0) return soft("smoking", "Tabagisme", 8, 8, "Aucune restriction");
  if (accepted.includes(cand)) return soft("smoking", "Tabagisme", 8, 8, `Accepté (${cand})`);
  if (cand === "quit" && accepted.includes("occasionally")) {
    return soft("smoking", "Tabagisme", 8, 5, "Ancien fumeur, crédit partiel");
  }
  return soft("smoking", "Tabagisme", 8, 0, `Non accepté (${cand})`);
}

function madhab(party: MatchParty, candidate: MatchParty): Scored {
  const accepted = party.prefs.acceptedMadhabs.map(norm);
  const cand = norm(candidate.profile.madhhab);

  // Red flag: a different madhab is an instant dealbreaker. The acceptable set
  // is the explicit whitelist if given, otherwise the seeker's own madhab.
  if (hasRedFlag(party, RED_FLAGS.differentMadhab)) {
    const allowed = accepted.length > 0 ? accepted : [norm(party.profile.madhhab)].filter(Boolean);
    if (cand && allowed.length > 0 && !allowed.includes(cand)) {
      return hard("madhab", "Madhab", 7, "Rédhibitoire : le demandeur exige le même madhab");
    }
  }

  if (accepted.length === 0) return soft("madhab", "Madhab", 7, 7, "Aucune préférence");
  if (accepted.includes(cand)) {
    return soft("madhab", "Madhab", 7, 7, `Préféré (${candidate.profile.madhhab})`);
  }
  return soft("madhab", "Madhab", 7, 2, `Madhab différent (${candidate.profile.madhhab})`);
}

function languages(party: MatchParty, candidate: MatchParty): Scored {
  const preferred = party.prefs.preferredLanguages.map(norm).filter(Boolean);
  const spoken = new Set(candidate.profile.languages.map(norm));

  // Red flag: no shared language is an instant dealbreaker. Compare against the
  // preferred-language list if given, otherwise the seeker's own languages.
  if (hasRedFlag(party, RED_FLAGS.differentLanguage)) {
    const required = preferred.length > 0 ? preferred : party.profile.languages.map(norm).filter(Boolean);
    if (required.length > 0 && !required.some((l) => spoken.has(l))) {
      return hard("languages", "Langues", 5, "Rédhibitoire : aucune langue commune");
    }
  }

  if (preferred.length === 0) return soft("languages", "Langues", 5, 5, "Aucune préférence");
  const matches = preferred.filter((l) => spoken.has(l)).length;
  const pct = matches / preferred.length;
  let pts: number;
  if (pct >= 0.8) pts = 5;
  else if (pct >= 0.5) pts = 3;
  else if (pct > 0) pts = 1;
  else pts = -1;
  return soft("languages", "Langues", 5, pts, `${matches}/${preferred.length} langues préférées`);
}

function countryRelocation(party: MatchParty, candidate: MatchParty): Scored {
  const sameCountry =
    !!norm(party.profile.country) && norm(party.profile.country) === norm(candidate.profile.country);
  if (sameCountry) return soft("country", "Pays / mobilité", 8, 8, "Même pays");

  // Red flag: a partner in a different country is an instant dealbreaker.
  if (hasRedFlag(party, RED_FLAGS.differentCountry)) {
    return hardSoft("country", "Pays / mobilité", 8, "Rédhibitoire : le demandeur exige le même pays");
  }
  // Red flag: a partner unwilling to relocate (when countries differ) is a dealbreaker.
  if (hasRedFlag(party, RED_FLAGS.wontRelocate) && !candidate.profile.willingToRelocate) {
    return hardSoft("country", "Pays / mobilité", 8, "Rédhibitoire : le partenaire doit être prêt à déménager");
  }

  if (party.prefs.sameCountryOnly) {
    return hardSoft("country", "Pays / mobilité", 8, "Le demandeur exige le même pays");
  }
  const seekerReloc = norm(party.prefs.willingToRelocate);
  const candReloc = candidate.profile.willingToRelocate;

  if (seekerReloc === "no" && !candReloc) {
    return hardSoft("country", "Pays / mobilité", 8, "Aucune des deux parties n'est prête à déménager");
  }
  if (seekerReloc === "open" || seekerReloc === "yes_if_needed") {
    return soft("country", "Pays / mobilité", 8, candReloc ? 8 : 5, candReloc ? "Les deux sont ouverts à déménager" : "Le demandeur est prêt, le candidat hésite");
  }
  if (seekerReloc === "no") {
    if (candReloc) return soft("country", "Pays / mobilité", 8, 6, "Seul le candidat est prêt à déménager");
    return hardSoft("country", "Pays / mobilité", 8, "Aucune des deux parties n'est prête à déménager");
  }
  // No stated relocation preference either side (the common case today — no
  // onboarding screen collects it yet) and the countries differ: partial
  // credit, not full marks — otherwise same-country and different-country
  // pairs score identically and the criterion never actually differentiates.
  return soft("country", "Pays / mobilité", 8, candReloc ? 5 : 3, "Pays différents, préférence de mobilité inconnue");
}

// --- bonus criteria (candidate profile only) ---

function timelineBonus(party: MatchParty, candidate: MatchParty): Scored {
  const seeker = scaleValue(TIMELINE_SCALE, party.prefs.marriageTimeline);
  const cand = scaleValue(TIMELINE_SCALE, candidate.profile.marriageGoals);
  if (seeker == null || cand == null) {
    return bonus("b_timeline", "Échéancier de mariage", 3, 0, "Données insuffisantes");
  }
  const diff = Math.abs(seeker - cand);
  let pts: number;
  if (diff === 0) pts = 3;
  else if (diff === 1) pts = 2;
  else if (diff <= 2) pts = 1;
  else pts = -1;
  return bonus("b_timeline", "Échéancier de mariage", 3, pts, `Écart d'échéancier ${diff}`);
}

function quranBonus(candidate: MatchParty): Scored {
  const v = norm(candidate.profile.quranLevel);
  const pts = ["recites", "memorising", "hafiz"].includes(v) ? 3 : 0;
  return bonus("b_quran", "Niveau de Coran", 3, pts, v || "aucun");
}

function islamicEducationBonus(candidate: MatchParty): Scored {
  const v = scaleValue(ISLAMIC_EDUCATION_SCALE, candidate.profile.islamicEducationLevel) ?? 0;
  const pts = v >= 2 ? 3 : v === 1 ? 1 : 0;
  return bonus("b_islamic_ed", "Éducation islamique", 3, pts, candidate.profile.islamicEducationLevel ?? "aucune");
}

function incomeBonus(candidate: MatchParty): Scored {
  const v = scaleValue(INCOME_SCALE, candidate.profile.incomeRange) ?? 0;
  return bonus("b_income", "Revenu", 2, v >= 3 ? 2 : 0, candidate.profile.incomeRange ?? "—");
}

function professionBonus(candidate: MatchParty): Scored {
  const p = norm(candidate.profile.profession);
  const match = p.length > 0 && HIGH_STATUS_PROFESSIONS.some((w) => p.includes(w));
  return bonus("b_profession", "Profession", 1, match ? 1 : 0, candidate.profile.profession ?? "—");
}

function heightBonus(candidate: MatchParty): Scored {
  const h = candidate.profile.heightCm;
  let pts = 0;
  if (h != null) {
    if (h >= 155 && h <= 180) pts = 2;
    else if (h >= 150 && h < 155) pts = 1;
    else if (h > 180 && h <= 190) pts = 1;
  }
  return bonus("b_height", "Taille", 2, pts, h != null ? `${h}cm` : "—");
}

function nationalityBonus(party: MatchParty, candidate: MatchParty): Scored {
  const cand = norm(candidate.profile.nationality);
  const seeker = norm(party.profile.nationality);
  let pts = 0;
  if (cand && seeker && cand === seeker) pts = 1;
  else if (cand && seeker && ARAB_NATIONALITIES.includes(cand) && ARAB_NATIONALITIES.includes(seeker)) pts = 0.5;
  else if (norm(party.profile.country) && norm(party.profile.country) === norm(candidate.profile.country)) pts = 0.5;
  return bonus("b_nationality", "Nationalité", 1, pts, candidate.profile.nationality ?? "—");
}

// --- small constructors to keep the criteria terse ---

function ok(key: string, label: string, priority: "hard", max: number, detail: string): Scored {
  return { criterion: { key, label, priority, points: max, maxPoints: max, detail } };
}
function hard(key: string, label: string, max: number, reason: string): Scored {
  return { criterion: { key, label, priority: "hard", points: 0, maxPoints: max, detail: reason }, hardFail: reason };
}
function soft(key: string, label: string, max: number, points: number, detail: string): Scored {
  return { criterion: { key, label, priority: "soft", points, maxPoints: max, detail } };
}
// Soft criterion that nonetheless trips a hard gate (country/relocation skips).
function hardSoft(key: string, label: string, max: number, reason: string): Scored {
  return { criterion: { key, label, priority: "soft", points: 0, maxPoints: max, detail: reason }, hardFail: reason };
}
function bonus(key: string, label: string, max: number, points: number, detail: string): Scored {
  return { criterion: { key, label, priority: "bonus", points, maxPoints: max, detail } };
}

// ---------------------------------------------------------------------------
// Importance overrides. When the seeker assigned an importance level to a
// dimension during onboarding, it overrides that criterion's default weight:
//   doesnt_matter → ignored (0/0)   preferred → bonus   important → full weight
//   must_have     → hard gate if the candidate does not satisfy it.
// When no importance is set, the criterion keeps its default behaviour, so the
// engine is unchanged for users who never set importance.
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Derive a 0..1 "fit" and a boolean "met" from a criterion's natural result.
function deriveFit(s: Scored): { fit: number; met: boolean } {
  const c = s.criterion;
  const fit = c.maxPoints > 0 ? clamp01(c.points / c.maxPoints) : c.points > 0 ? 1 : 0;
  const met = !s.hardFail && (c.maxPoints > 0 ? c.points >= c.maxPoints * 0.5 : c.points > 0);
  return { fit, met };
}

function applyImportance(party: MatchParty, s: Scored): Scored {
  const dimension = CRITERION_TO_DIMENSION[s.criterion.key];
  const level = dimension ? norm(party.prefs.preferenceImportance[dimension]) : "";
  if (!level) return s; // no importance set → default behaviour

  const { key, label, detail } = s.criterion;
  const { fit, met } = deriveFit(s);

  switch (level) {
    case IMPORTANCE.doesntMatter:
      return { criterion: { key, label, priority: "soft", points: 0, maxPoints: 0, detail: "Sans importance" } };
    case IMPORTANCE.preferred:
      return {
        criterion: { key, label, priority: "bonus", points: Math.round(fit * W_PREFERRED), maxPoints: W_PREFERRED, detail: `${detail} · préféré` },
      };
    case IMPORTANCE.important:
      return {
        criterion: { key, label, priority: "soft", points: Math.round(fit * W_IMPORTANT), maxPoints: W_IMPORTANT, detail: `${detail} · important` },
      };
    case IMPORTANCE.mustHave:
      if (met) {
        return { criterion: { key, label, priority: "soft", points: W_IMPORTANT, maxPoints: W_IMPORTANT, detail: `${detail} · indispensable ✓` } };
      }
      return {
        criterion: { key, label, priority: "hard", points: 0, maxPoints: W_IMPORTANT, detail: `Indispensable non satisfait : ${label}` },
        hardFail: `${label} (indispensable)`,
      };
    default:
      return s;
  }
}

// --- lifestyle / personality alignment ---

function lifestyleFit(qKey: string, a: string, b: string): number {
  const q = LIFESTYLE_QUESTIONS[qKey];
  if (!q) return 0;
  const ia = q.scale.indexOf(a);
  const ib = q.scale.indexOf(b);
  if (ia < 0 || ib < 0) return 0;
  if (q.ordinal) {
    const span = Math.max(1, q.scale.length - 1);
    return clamp01(1 - Math.abs(ia - ib) / span);
  }
  return ia === ib ? 1 : 0.4; // categorical: exact match or partial
}

// Score the lifestyle questions the seeker marked as mattering, by comparing
// both partners' answers. Each becomes a criterion run through applyImportance.
function lifestyleScored(seeker: MatchParty, candidate: MatchParty): Scored[] {
  const out: Scored[] = [];
  for (const [qKey, q] of Object.entries(LIFESTYLE_QUESTIONS)) {
    const level = norm(seeker.prefs.lifestyleImportance[qKey]);
    if (!level || level === IMPORTANCE.doesntMatter) continue;
    const a = norm(seeker.prefs.lifestyleAnswers[qKey]);
    const b = norm(candidate.prefs.lifestyleAnswers[qKey]);
    if (!a || !b) continue; // need both answers to compare

    const fit = lifestyleFit(qKey, a, b);
    const met = fit >= 0.5;
    const key = `life_${qKey}`;
    const detail = `${a} vs ${b}`;

    if (level === IMPORTANCE.mustHave) {
      out.push(
        met
          ? { criterion: { key, label: q.label, priority: "soft", points: W_IMPORTANT, maxPoints: W_IMPORTANT, detail: `${detail} · indispensable ✓` } }
          : {
              criterion: { key, label: q.label, priority: "hard", points: 0, maxPoints: W_IMPORTANT, detail: `Indispensable non satisfait : ${q.label}` },
              hardFail: `${q.label} (indispensable)`,
            },
      );
    } else if (level === IMPORTANCE.important) {
      out.push({ criterion: { key, label: q.label, priority: "soft", points: Math.round(fit * W_IMPORTANT), maxPoints: W_IMPORTANT, detail: `${detail} · important` } });
    } else {
      out.push({ criterion: { key, label: q.label, priority: "bonus", points: Math.round(fit * W_PREFERRED), maxPoints: W_PREFERRED, detail: `${detail} · préféré` } });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scoreMatch(seeker: MatchParty, candidate: MatchParty): MatchResult {
  const natural: Scored[] = [
    genderGate(seeker, candidate),
    age(seeker, candidate),
    practice(seeker, candidate),
    prayer(seeker, candidate),
    hijab(seeker, candidate),
    maritalStatus(seeker, candidate),
    hasChildren(seeker, candidate),
    wantsChildren(seeker, candidate),
    education(seeker, candidate),
    smoking(seeker, candidate),
    madhab(seeker, candidate),
    languages(seeker, candidate),
    countryRelocation(seeker, candidate),
    timelineBonus(seeker, candidate),
    quranBonus(candidate),
    islamicEducationBonus(candidate),
    incomeBonus(candidate),
    professionBonus(candidate),
    heightBonus(candidate),
    nationalityBonus(seeker, candidate),
  ];

  // Gender is always a hard gate; every other criterion can be re-weighted by
  // the seeker's importance choices. Lifestyle questions are appended.
  const scored: Scored[] = [
    // Gender is a fixed gate; not-applicable criteria (maxPoints 0, e.g. prayer
    // or hijab with no data) are left untouched so importance can't turn missing
    // data into a hard failure.
    ...natural.map((s) =>
      s.criterion.key === "gender" || s.criterion.maxPoints === 0 ? s : applyImportance(seeker, s),
    ),
    ...lifestyleScored(seeker, candidate),
  ];

  const criteria = scored.map((s) => s.criterion);
  const hardFailures = scored.map((s) => s.hardFail).filter((x): x is string => Boolean(x));

  const baseScore = criteria
    .filter((c) => c.priority !== "bonus")
    .reduce((sum, c) => sum + c.points, 0);
  const bonusRaw = criteria
    .filter((c) => c.priority === "bonus")
    .reduce((sum, c) => sum + c.points, 0);
  const bonusScore = Math.min(BONUS_CAP, bonusRaw);

  const passedHard = hardFailures.length === 0;
  const score = passedHard ? Math.max(0, Math.min(MAX_SCORE, baseScore + bonusScore)) : 0;

  return {
    score,
    passedHard,
    hardFailures,
    baseScore,
    bonusScore,
    criteria,
    rationale: buildRationale(score, passedHard, hardFailures, criteria),
  };
}

export function scoreReciprocal(a: MatchParty, b: MatchParty): ReciprocalResult {
  const seekerToCandidate = scoreMatch(a, b);
  const candidateToSeeker = scoreMatch(b, a);
  const mutualPass = seekerToCandidate.passedHard && candidateToSeeker.passedHard;
  const mutualScore = mutualPass
    ? Math.round((seekerToCandidate.score + candidateToSeeker.score) / 2)
    : 0;
  return { seekerToCandidate, candidateToSeeker, mutualScore, mutualPass };
}

function buildRationale(
  score: number,
  passedHard: boolean,
  hardFailures: string[],
  criteria: CriterionScore[],
): string {
  if (!passedHard) {
    return `Condition rédhibitoire non satisfaite : ${hardFailures.join("; ")}`;
  }
  const band =
    score >= 85 ? "Excellent jumelage" : score >= 70 ? "Bon jumelage" : score >= 50 ? "Jumelage modéré" : "Jumelage faible";
  const strengths = criteria
    .filter((c) => c.priority !== "bonus" && c.maxPoints > 0 && c.points === c.maxPoints)
    .slice(0, 4)
    .map((c) => c.label.toLowerCase());
  const weak = criteria.filter((c) => c.priority !== "bonus" && c.points < c.maxPoints / 2).map((c) => c.label.toLowerCase());
  let out = `${band} (${score}/100).`;
  if (strengths.length) out += ` Points forts : ${strengths.join(", ")}.`;
  if (weak.length) out += ` À surveiller : ${weak.join(", ")}.`;
  return out;
}
