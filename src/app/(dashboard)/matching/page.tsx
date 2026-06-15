import { Suspense } from "react";
import { HeartHandshake, ChevronDown, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  listMatchableMembers,
  rankCandidatesFor,
  existingMatchStatusFor,
  matchedUserIds,
  type RankedCandidate,
} from "@/lib/data/matching";
import type { CriterionScore } from "@/lib/matching/types";
import type { MatchStatus } from "@/lib/types/database";
import { MemberPicker } from "./member-picker";
import { SendRequestButton } from "./send-request-button";
import { CandidatesSkeleton } from "./candidates-skeleton";

export const dynamic = "force-dynamic";

function scoreVariant(score: number): "green" | "blue" | "amber" | "default" {
  if (score >= 85) return "green";
  if (score >= 70) return "blue";
  if (score >= 50) return "amber";
  return "default";
}

function CriterionRow({ c }: { c: CriterionScore }) {
  const full = c.maxPoints > 0 && c.points >= c.maxPoints;
  const negative = c.points < 0;
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <div className="min-w-0">
        <span className="text-neutral-700">{c.label}</span>
        <span className="ml-2 text-xs text-neutral-400">{c.detail}</span>
      </div>
      <span
        className={cn(
          "shrink-0 font-mono text-xs",
          negative ? "text-red-600" : full ? "text-emerald-600" : "text-neutral-500",
        )}
      >
        {c.points}/{c.maxPoints}
      </span>
    </div>
  );
}

function CandidateCard({
  c,
  seekerId,
  existingStatus,
  unavailable,
}: {
  c: RankedCandidate;
  seekerId: string;
  existingStatus?: MatchStatus;
  unavailable?: boolean;
}) {
  const { result } = c;
  const primary = result.seekerToCandidate;
  const passed = result.mutualPass;

  return (
    <Card className={cn(!passed && "opacity-70")}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-neutral-900">{c.name}</h3>
              <span className="text-xs text-neutral-400">
                {c.age != null ? `${c.age} yrs` : "—"} ·{" "}
                {[c.city, c.country].filter(Boolean).join(", ") || "—"}
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-500">{primary.rationale}</p>
          </div>
          <div className="text-right">
            {passed ? (
              <Badge variant={scoreVariant(result.mutualScore)} className="text-sm">
                {result.mutualScore}
              </Badge>
            ) : (
              <Badge variant="red" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Incompatible
              </Badge>
            )}
            <div className="mt-1 text-xs text-neutral-400">
              {primary.score} ↔ {result.candidateToSeeker.score}
            </div>
          </div>
        </div>

        {!passed && primary.hardFailures.length > 0 && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {[...new Set([...primary.hardFailures, ...result.candidateToSeeker.hardFailures])].join(
              " · ",
            )}
          </p>
        )}

        <details className="group mt-3">
          <summary className="flex cursor-pointer items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            Score breakdown ({c.name} as candidate)
          </summary>
          <div className="mt-2 divide-y divide-neutral-100 border-t border-neutral-100 pt-1">
            {primary.criteria.map((cr: CriterionScore) => (
              <CriterionRow key={cr.key} c={cr} />
            ))}
            <div className="flex items-center justify-between pt-2 text-xs text-neutral-500">
              <span>Base {primary.baseScore} + bonus {primary.bonusScore}</span>
              <span className="font-semibold">= {primary.score}/100</span>
            </div>
          </div>
        </details>

        <div className="mt-3 flex justify-end border-t border-neutral-100 pt-3">
          <SendRequestButton
            seekerId={seekerId}
            candidateId={c.userId}
            score={result.mutualScore}
            disabled={!passed}
            existingStatus={existingStatus}
            unavailable={unavailable}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Scores the candidate pool for the selected member. Isolated in its own async
// component so it can be wrapped in <Suspense>: the page shell (sidebar + header)
// renders immediately and this streams in behind a shimmer, instead of the whole
// page blocking on the ~5 queries + scoring loop every time a member is clicked.
async function CandidatePanel({ memberId }: { memberId: string }) {
  const [ranked, existingStatuses, matchedSet] = await Promise.all([
    rankCandidatesFor(memberId),
    existingMatchStatusFor(memberId),
    matchedUserIds(),
  ]);

  if (!ranked.member) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-neutral-500">
          This member has no profile yet — nothing to match on.
        </CardContent>
      </Card>
    );
  }

  const seekerMatched = matchedSet.has(memberId);

  return (
    <>
      {seekerMatched && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-emerald-800">
            <HeartHandshake className="h-4 w-4 shrink-0" />
            {ranked.member.name} is already in a confirmed match and can&apos;t
            receive new requests.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">
            Candidates for {ranked.member.name}
          </h2>
          <span className="text-sm text-neutral-400">
            {ranked.candidates.filter((c) => c.result.mutualPass).length} compatible ·{" "}
            {ranked.candidates.length} total
          </span>
        </div>
        {ranked.candidates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-neutral-500">
              No eligible candidates found.
            </CardContent>
          </Card>
        ) : (
          ranked.candidates.map((c) => (
            <CandidateCard
              key={c.userId}
              c={c}
              seekerId={ranked.member!.userId}
              existingStatus={existingStatuses.get(c.userId)}
              unavailable={seekerMatched || matchedSet.has(c.userId)}
            />
          ))
        )}
      </div>
    </>
  );
}

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member: memberId } = await searchParams;
  const members = await listMatchableMembers();

  return (
    <div>
      <PageHeader
        title="Matching"
        description="Semi-automatic matchmaking — pick a member, review scored candidates, then introduce."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_1fr]">
        <Card className="lg:h-[calc(100vh-12rem)]">
          <CardContent className="flex h-full flex-col pt-5">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">
              Members ({members.length})
            </h2>
            <MemberPicker members={members} selectedId={memberId} />
          </CardContent>
        </Card>

        <div>
          {!memberId ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                  <HeartHandshake className="h-8 w-8" />
                </div>
                <div className="max-w-md">
                  <h2 className="text-lg font-semibold text-neutral-900">Select a member</h2>
                  <p className="mt-2 text-sm text-neutral-500">
                    Choose a member on the left to score every eligible candidate against their
                    profile and partner preferences.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Suspense key={memberId} fallback={<CandidatesSkeleton />}>
              <CandidatePanel memberId={memberId} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
