import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Shimmer shown in the candidate panel while `rankCandidatesFor` scores the pool
// for the newly selected member. Mirrors the real candidate-card layout so the
// switch between members feels instant instead of a frozen page.
export function CandidatesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72 max-w-full" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
            <Skeleton className="mt-4 h-4 w-40" />
            <div className="mt-3 flex justify-end border-t border-neutral-100 pt-3">
              <Skeleton className="h-8 w-40" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
