"use client";

import { useState, useTransition } from "react";
import { updateUserStatus } from "../actions";
import { Button } from "@/components/ui/button";
import type { UserStatus } from "@/lib/types/database";

export function UserStatusActions({
  userId,
  status,
}: {
  userId: string;
  status: UserStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(next: UserStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await updateUserStatus(userId, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status !== "suspended" ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => set("suspended")}
          >
            Suspend
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            disabled={pending}
            onClick={() => set("active")}
          >
            Reactivate
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
