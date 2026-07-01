"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { mahramRespondAsAdmin } from "../matching/actions";
import { Button } from "@/components/ui/button";

// Admin proxy for the guardian's decision on a match awaiting mahram approval.
// Shown only while status is 'matched' and mahram_status is 'pending'.
export function MahramApprovalButtons({ matchId }: { matchId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function respond(response: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const res = await mahramRespondAsAdmin(matchId, response);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          variant="default"
          size="sm"
          disabled={pending}
          onClick={() => respond("approved")}
        >
          <Check className="h-4 w-4" /> Approuver
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => respond("rejected")}
        >
          <X className="h-4 w-4" /> Rejeter
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
