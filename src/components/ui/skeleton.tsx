import { cn } from "@/lib/utils";

// Animated placeholder block. Used by route-level loading.tsx files so a section
// renders its layout instantly and only the data area shimmers until it streams in.
// The `shimmer` class (globals.css) sweeps a light band across a neutral base.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded", className)} />;
}
