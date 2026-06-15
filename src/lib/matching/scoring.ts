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
        label: "Gender",
        priority: "hard",
        points: 0,
        maxPoints: 0,
        detail: "Same gender — not a valid match",
      },
      hardFail: "Same-gender pairing",
    };
  }
  return {
    criterion: {
      key: "gender",
      label: "Gender",
      priority: "hard",
      points: 0,
      maxPoints: 0,
      detail: a && b ? "Opposite gender" : "Gender not set",
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
  else hardFail = "Age outside both partners' accepted ranges";

  return {
    criterion: {
      key: "age",
      label: "Age",
      priority: "hard",
      points,
      maxPoints: 15,
      detail:
        hardFail ??
        `Candidate ${candAge ?? "?"} / seeker ${seekerAge ?? "?"} — ${
          candInSeeker && seekerInCand ? "both ranges satisfied" : "one direction only"
        }`,
    },
    hardFail,
  };
}

function practice(party: MatchParty, candidate: MatchParty): Scored {
  const min = scaleValue(PRACTICE_SCALE, party.prefs.minPracticeLevel);
  if (min == null) {
    return ok("practice", "Practice level", "hard", 12, "No minimum required");
  }
  const cand = scaleValue(PRACTICE_SCALE, candidate.profile.practiceLevel) ?? 0;
  if (cand >= min) {
    return ok("practice", "Practice level", "hard", 12, `Meets minimum (${candidate.profile.practiceLevel})`);
  }
  return hard("practice", "Practice level", 12, `Below minimum practice level (${party.prefs.minPracticeLevel})`);
}

function maritalStatus(party: MatchParty, candidate: MatchParty): Scored {
  const accepted = party.prefs.acceptedMaritalStatuses.map(norm);
  if (accepted.length === 0) {
    return ok("marital", "Marital status", "hard", 12, "No restriction");
  }
  if (accepted.includes(norm(candidate.profile.maritalStatus))) {
    return ok("marital", "Marital status", "hard", 12, `Accepted (${candidate.profile.maritalStatus})`);
  }
  return hard("marital", "Marital status", 12, `Marital status not accepted (${candidate.profile.maritalStatus})`);
}

function hasChildren(party: MatchParty, candidate: MatchParty): Scored {
  if (candidate.profile.hasChildren && !party.prefs.acceptsPartnerChildren) {
    return hard("children_has", "Has children", 10, "Candidate has children; seeker does not accept");
  }
  return ok(
    "children_has",
    "Has children",
    "hard",
    10,
    candidate.profile.hasChildren ? "Has children — accepted" : "No children",
  );
}

function wantsChildren(party: MatchParty, candidate: MatchParty): Scored {
  const cand = norm(candidate.profile.wantsChildren);
  const seeker = norm(party.profile.wantsChildren);
  if (!cand || !seeker) {
    return soft("children_wants", "Wants children", 10, 0, "Insufficient data");
  }
  const pts = WANTS_CHILDREN_MATRIX[`${cand}|${seeker}`] ?? 0;
  return soft("children_wants", "Wants children", 10, pts, `${cand} vs ${seeker}`);
}

function education(party: MatchParty, candidate: MatchParty): Scored {
  const min = scaleValue(EDUCATION_SCALE, party.prefs.minEducationLevel);
  if (min == null) {
    return soft("education", "Education level", 10, 10, "No minimum required");
  }
  const cand = scaleValue(EDUCATION_SCALE, candidate.profile.educationLevel) ?? 0;
  if (cand >= min) return soft("education", "Education level", 10, 10, "Meets or exceeds minimum");
  if (cand === min - 1) return soft("education", "Education level", 10, 5, "One level below minimum");
  return soft("education", "Education level", 10, 0, "Two or more levels below minimum");
}

function smoking(party: MatchParty, candidate: MatchParty): Scored {
  const accepted = party.prefs.acceptedSmokingStatuses.map(norm);
  const cand = norm(candidate.profile.smokingStatus);

  // Red flag: an active smoker (occasionally|regularly) is an instant dealbreaker.
  if (hasRedFlag(party, RED_FLAGS.smoking) && (cand === "occasionally" || cand === "regularly")) {
    return hard("smoking", "Smoking status", 8, "Dealbreaker: seeker rejects smokers");
  }

  if (accepted.length === 0) return soft("smoking", "Smoking status", 8, 8, "No restriction");
  if (accepted.includes(cand)) return soft("smoking", "Smoking status", 8, 8, `Accepted (${cand})`);
  if (cand === "quit" && accepted.includes("occasionally")) {
    return soft("smoking", "Smoking status", 8, 5, "Former smoker, partial credit");
  }
  return soft("smoking", "Smoking status", 8, 0, `Not accepted (${cand})`);
}

function madhab(party: MatchParty, candidate: MatchParty): Scored {
  const accepted = party.prefs.acceptedMadhabs.map(norm);
  const cand = norm(candidate.profile.madhhab);

  // Red flag: a different madhab is an instant dealbreaker. The acceptable set
  // is the explicit whitelist if given, otherwise the seeker's own madhab.
  if (hasRedFlag(party, RED_FLAGS.differentMadhab)) {
    const allowed = accepted.length > 0 ? accepted : [norm(party.profile.madhhab)].filter(Boolean);
    if (cand && allowed.length > 0 && !allowed.includes(cand)) {
      return hard("madhab", "Madhab", 7, "Dealbreaker: seeker requires the same madhab");
    }
  }

  if (accepted.length === 0) return soft("madhab", "Madhab", 7, 7, "No preference");
  if (accepted.includes(cand)) {
    return soft("madhab", "Madhab", 7, 7, `Preferred (${candidate.profile.madhhab})`);
  }
  return soft("madhab", "Madhab", 7, 2, `Different madhab (${candidate.profile.madhhab})`);
}

function languages(party: MatchParty, candidate: MatchParty): Scored {
  const preferred = party.prefs.preferredLanguages.map(norm).filter(Boolean);
  const spoken = new Set(candidate.profile.languages.map(norm));

  // Red flag: no shared language is an instant dealbreaker. Compare against the
  // preferred-language list if given, otherwise the seeker's own languages.
  if (hasRedFlag(party, RED_FLAGS.differentLanguage)) {
    const required = preferred.length > 0 ? preferred : party.profile.languages.map(norm).filter(Boolean);
    if (required.length > 0 && !required.some((l) => spoken.has(l))) {
      return hard("languages", "Languages", 5, "Dealbreaker: no shared language");
    }
  }

  if (preferred.length === 0) return soft("languages", "Languages", 5, 5, "No preference");
  const matches = preferred.filter((l) => spoken.has(l)).length;
  const pct = matches / preferred.length;
  let pts: number;
  if (pct >= 0.8) pts = 5;
  else if (pct >= 0.5) pts = 3;
  else if (pct > 0) pts = 1;
  else pts = -1;
  return soft("languages", "Languages", 5, pts, `${matches}/${preferred.length} preferred languages`);
}

function countryRelocation(party: MatchParty, candidate: MatchParty): Scored {
  const sameCountry =
    !!norm(party.profile.country) && norm(party.profile.country) === norm(candidate.profile.country);
  if (sameCountry) return soft("country", "Country / relocation", 8, 8, "Same country");

  // Red flag: a partner in a different country is an instant dealbreaker.
  if (hasRedFlag(party, RED_FLAGS.differentCountry)) {
    return hardSoft("country", "Country / relocation", 8, "Dealbreaker: seeker requires the same country");
  }
  // Red flag: a partner unwilling to relocate (when countries differ) is a dealbreaker.
  if (hasRedFlag(party, RED_FLAGS.wontRelocate) && !candidate.profile.willingToRelocate) {
    return hardSoft("country", "Country / relocation", 8, "Dealbreaker: partner must be willing to relocate");
  }

  if (party.prefs.sameCountryOnly) {
    return hardSoft("country", "Country / relocation", 8, "Seeker requires same country");
  }
  const seekerReloc = norm(party.prefs.willingToRelocate);
  const candReloc = candidate.profile.willingToRelocate;

  if (seekerReloc === "no" && !candReloc) {
    return hardSoft("country", "Country / relocation", 8, "Neither party willing to relocate");
  }
  if (seekerReloc === "open" || seekerReloc === "yes_if_needed") {
    return soft("country", "Country / relocation", 8, candReloc ? 8 : 5, candReloc ? "Both open to relocate" : "Seeker willing, candidate unsure");
  }
  if (seekerReloc === "no") {
    if (candReloc) return soft("country", "Country / relocation", 8, 6, "Only candidate willing to relocate");
    return hardSoft("country", "Country / relocation", 8, "Neither party willing to relocate");
  }
  return soft("country", "Country / relocation", 8, 8, "Open to relocation");
}

// --- bonus criteria (candidate profile only) ---

function timelineBonus(party: MatchParty, candidate: MatchParty): Scored {
  const seeker = scaleValue(TIMELINE_SCALE, party.prefs.marriageTimeline);
  const cand = scaleValue(TIMELINE_SCALE, candidate.profile.marriageGoals);
  if (seeker == null || cand == null) {
    return bonus("b_timeline", "Marriage timeline", 3, 0, "Insufficient data");
  }
  const diff = Math.abs(seeker - cand);
  let pts: number;
  if (diff === 0) pts = 3;
  else if (diff === 1) pts = 2;
  else if (diff <= 2) pts = 1;
  else pts = -1;
  return bonus("b_timeline", "Marriage timeline", 3, pts, `Timeline gap ${diff}`);
}

function quranBonus(candidate: MatchParty): Scored {
  const v = norm(candidate.profile.quranLevel);
  const pts = ["recites", "memorising", "hafiz"].includes(v) ? 3 : 0;
  return bonus("b_quran", "Qur'an level", 3, pts, v || "none");
}

function islamicEducationBonus(candidate: MatchParty): Scored {
  const v = scaleValue(ISLAMIC_EDUCATION_SCALE, candidate.profile.islamicEducationLevel) ?? 0;
  const pts = v >= 2 ? 3 : v === 1 ? 1 : 0;
  return bonus("b_islamic_ed", "Islamic education", 3, pts, candidate.profile.islamicEducationLevel ?? "none");
}

function incomeBonus(candidate: MatchParty): Scored {
  const v = scaleValue(INCOME_SCALE, candidate.profile.incomeRange) ?? 0;
  return bonus("b_income", "Income range", 2, v >= 3 ? 2 : 0, candidate.profile.incomeRange ?? "—");
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
  return bonus("b_height", "Height", 2, pts, h != null ? `${h}cm` : "—");
}

function nationalityBonus(party: MatchParty, candidate: MatchParty): Scored {
  const cand = norm(candidate.profile.nationality);
  const seeker = norm(party.profile.nationality);
  let pts = 0;
  if (cand && seeker && cand === seeker) pts = 1;
  else if (cand && seeker && ARAB_NATIONALITIES.includes(cand) && ARAB_NATIONALITIES.includes(seeker)) pts = 0.5;
  else if (norm(party.profile.country) && norm(party.profile.country) === norm(candidate.profile.country)) pts = 0.5;
  return bonus("b_nationality", "Nationality", 1, pts, candidate.profile.nationality ?? "—");
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
      return { criterion: { key, label, priority: "soft", points: 0, maxPoints: 0, detail: "Doesn't matter" } };
    case IMPORTANCE.preferred:
      return {
        criterion: { key, label, priority: "bonus", points: Math.round(fit * W_PREFERRED), maxPoints: W_PREFERRED, detail: `${detail} · preferred` },
      };
    case IMPORTANCE.important:
      return {
        criterion: { key, label, priority: "soft", points: Math.round(fit * W_IMPORTANT), maxPoints: W_IMPORTANT, detail: `${detail} · important` },
      };
    case IMPORTANCE.mustHave:
      if (met) {
        return { criterion: { key, label, priority: "soft", points: W_IMPORTANT, maxPoints: W_IMPORTANT, detail: `${detail} · must-have ✓` } };
      }
      return {
        criterion: { key, label, priority: "hard", points: 0, maxPoints: W_IMPORTANT, detail: `Must-have not met: ${label}` },
        hardFail: `${label} (must-have)`,
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
          ? { criterion: { key, label: q.label, priority: "soft", points: W_IMPORTANT, maxPoints: W_IMPORTANT, detail: `${detail} · must-have ✓` } }
          : {
              criterion: { key, label: q.label, priority: "hard", points: 0, maxPoints: W_IMPORTANT, detail: `Must-have not met: ${q.label}` },
              hardFail: `${q.label} (must-have)`,
            },
      );
    } else if (level === IMPORTANCE.important) {
      out.push({ criterion: { key, label: q.label, priority: "soft", points: Math.round(fit * W_IMPORTANT), maxPoints: W_IMPORTANT, detail: `${detail} · important` } });
    } else {
      out.push({ criterion: { key, label: q.label, priority: "bonus", points: Math.round(fit * W_PREFERRED), maxPoints: W_PREFERRED, detail: `${detail} · preferred` } });
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
    ...natural.map((s) => (s.criterion.key === "gender" ? s : applyImportance(seeker, s))),
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
    return `Hard requirement failed: ${hardFailures.join("; ")}`;
  }
  const band =
    score >= 85 ? "Excellent match" : score >= 70 ? "Strong match" : score >= 50 ? "Moderate match" : "Weak match";
  const strengths = criteria
    .filter((c) => c.priority !== "bonus" && c.maxPoints > 0 && c.points === c.maxPoints)
    .slice(0, 4)
    .map((c) => c.label.toLowerCase());
  const weak = criteria.filter((c) => c.priority !== "bonus" && c.points < c.maxPoints / 2).map((c) => c.label.toLowerCase());
  let out = `${band} (${score}/100).`;
  if (strengths.length) out += ` Strong on ${strengths.join(", ")}.`;
  if (weak.length) out += ` Watch: ${weak.join(", ")}.`;
  return out;
}
