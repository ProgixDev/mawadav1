"use client";

import { useTransition } from "react";
import { cancelMatch } from "../matching/actions";
import { Button } from "@/components/ui/button";

export function CancelMatchButton({ matchId }: { matchId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => { await cancelMatch(matchId); })}
    >
      Cancel
    </Button>
  );
}
