import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="ml-auto h-8 w-32" />
      </div>

      <Card>
        <CardContent className="space-y-4 py-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={i % 2 === 0 ? "flex justify-start" : "flex justify-end"}
            >
              <Skeleton
                className={`h-12 ${i % 3 === 0 ? "w-64" : "w-48"} rounded-2xl`}
              />
            </div>
          ))}
          <Skeleton className="mt-4 h-11 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  );
}
