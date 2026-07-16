"use client";

import { useState, useTransition } from "react";
import { Check, Send } from "lucide-react";
import { sendMatchRequest } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MatchStatus } from "@/lib/types/database";

const STATUS_BADGE: Record<MatchStatus, { variant: "green" | "blue" | "amber" | "red" | "default"; label: string }> = {
  pending: { variant: "amber", label: "En attente" },
  matched: { variant: "green", label: "Jumelé" },
  declined: { variant: "red", label: "Refusé" },
  expired: { variant: "default", label: "Expiré" },
  cancelled: { variant: "default", label: "Annulé" },
  ended: { variant: "amber", label: "Terminé" },
  rejected: { variant: "red", label: "Rejeté (mahram)" },
};

export function SendRequestButton({
  seekerId,
  candidateId,
  existingStatus,
  unavailable,
  forced,
}: {
  seekerId: string;
  candidateId: string;
  score: number;
  existingStatus?: MatchStatus;
  /** Either party is already in a confirmed match elsewhere → no new request. */
  unavailable?: boolean;
  /** This pair failed a hard gate — sending is still allowed, but confirm first. */
  forced?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (existingStatus) {
    const b = STATUS_BADGE[existingStatus];
    return <Badge variant={b.variant}>{b.label}</Badge>;
  }

  if (unavailable) {
    return <Badge variant="default">Déjà jumelé</Badge>;
  }

  if (sent) {
    return (
      <Badge variant="amber" className="flex items-center gap-1">
        <Check className="h-3 w-3" /> Demande envoyée
      </Badge>
    );
  }

  function send() {
    if (
      forced &&
      !confirm(
        "Ce binôme ne remplit pas tous les critères de compatibilité. Envoyer quand même la demande de jumelage ?",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await sendMatchRequest(seekerId, candidateId);
      if (res.ok) setSent(true);
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={send}
        className={forced ? "border-amber-300 text-amber-800 hover:bg-amber-50" : undefined}
      >
        <Send className="h-3.5 w-3.5" />
        {forced ? "Forcer le jumelage" : "Envoyer la demande de jumelage"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
