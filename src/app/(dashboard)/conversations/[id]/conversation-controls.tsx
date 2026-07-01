"use client";

import { useTransition } from "react";
import { setAdminStatus } from "../actions";
import { cn } from "@/lib/utils";
import type { AdminStatus } from "@/lib/types/database";

const OPTIONS: { value: AdminStatus; label: string }[] = [
  { value: "new", label: "Nouvelle" },
  { value: "in_contact", label: "En contact" },
  { value: "paused", label: "En pause" },
];

export function ConversationControls({
  conversationId,
  current,
}: {
  conversationId: string;
  current: AdminStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center rounded-lg border border-neutral-200 bg-white p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setAdminStatus(conversationId, o.value);
            })
          }
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
            current === o.value
              ? "bg-brand text-white"
              : "text-neutral-600 hover:bg-neutral-100",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
