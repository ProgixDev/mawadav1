"use client";

import { useMemo, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MatchableMember } from "@/lib/data/matching";

// Lives inside a <Link>; spins the moment that member is clicked so the picker
// confirms the click instantly while the candidate panel streams behind a shimmer.
function PendingSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" />;
}

export function MemberPicker({
  members,
  selectedId,
}: {
  members: MatchableMember[];
  selectedId?: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((m) =>
      [m.name, m.city, m.country].filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [q, members]);

  return (
    <div className="flex h-full flex-col">

      
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search members…"
          className="pl-9"
        />
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <p className="px-2 py-4 text-sm text-neutral-400">No members found.</p>
        )}
        {filtered.map((m) => (
          <Link
            key={m.userId}
            href={`/matching?member=${m.userId}`}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm transition-colors",
              m.userId === selectedId
                ? "bg-brand/10 text-brand"
                : "text-neutral-700 hover:bg-neutral-100",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{m.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                <PendingSpinner />
                {m.gender === "male" ? "♂" : m.gender === "female" ? "♀" : ""}{" "}
                {m.age ?? "—"}
              </span>
            </div>
            <div className="truncate text-xs text-neutral-400">
              {[m.city, m.country].filter(Boolean).join(", ") || "—"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
