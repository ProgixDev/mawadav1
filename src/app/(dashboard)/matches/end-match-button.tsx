"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endMatch } from "../matching/actions";
import { Button } from "@/components/ui/button";

export function EndMatchButton({ matchId }: { matchId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              "Mettre fin à ce jumelage ? Les deux membres pourront de nouveau recevoir des demandes de jumelage. Cette action est irréversible.",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const res = await endMatch(matchId);
            if (res.ok) router.refresh();
            else setError(res.error);
          });
        }}
      >
        {pending ? "Fin en cours…" : "Mettre fin au jumelage"}
      </Button>
      {error && <p className="max-w-48 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
