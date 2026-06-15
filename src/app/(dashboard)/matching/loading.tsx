import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MatchingLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_1fr]">
        {/* Member picker */}
        <Card className="lg:h-[calc(100vh-12rem)]">
          <CardContent className="flex h-full flex-col gap-3 pt-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-10" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Candidate cards */}
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
      </div>
    </div>
  );
}
