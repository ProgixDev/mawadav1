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
  disabled,
  existingStatus,
  unavailable,
}: {
  seekerId: string;
  candidateId: string;
  score: number;
  disabled?: boolean;
  existingStatus?: MatchStatus;
  /** Either party is already in a confirmed match elsewhere → no new request. */
  unavailable?: boolean;
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
    setError(null);
    startTransition(async () => {
      const res = await sendMatchRequest(seekerId, candidateId);
      if (res.ok) setSent(true);
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" disabled={pending || disabled} onClick={send}>
        <Send className="h-3.5 w-3.5" />
        Envoyer la demande de jumelage
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
