"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "suspended", label: "Suspended" },
  { value: "deleted", label: "Deleted" },
];

export function UsersToolbar({
  defaultQuery,
  defaultStatus,
}: {
  defaultQuery: string;
  defaultStatus: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);

  function apply(next: { q?: string; status?: string }) {
    const params = new URLSearchParams();
    const q = next.q ?? query;
    const status = next.status ?? defaultStatus;
    if (q) params.set("q", q);
    if (status && status !== "all") params.set("status", status);
    router.push(`/users${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: query });
        }}
        className="relative flex-1 min-w-[220px]"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email…"
          className="pl-9"
        />
      </form>
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => apply({ status: s.value })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              defaultStatus === s.value
                ? "bg-brand text-white"
                : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
