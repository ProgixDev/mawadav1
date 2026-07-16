import Link from "next/link";
import { listMatches } from "@/lib/data/matching";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  MatchStatusBadge,
  MatchResponseBadge,
} from "@/components/dashboard/status-badges";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CancelMatchButton } from "./cancel-match-button";
import { EndMatchButton } from "./end-match-button";

export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "all", label: "Tous" },
  { value: "pending", label: "Envoyés" },
  { value: "matched", label: "Jumelés" },
  { value: "declined", label: "Refusés" },
  { value: "expired", label: "Expirés" },
  { value: "cancelled", label: "Annulés" },
  { value: "ended", label: "Terminés" },
];

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const matches = await listMatches(status);

  return (
    <div>
      <PageHeader
        title="Jumelages"
        description="Demandes de jumelage envoyées aux paires classées — suivez les réponses, les expirations et triez par statut."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/matches" : `/matches?status=${f.value}`}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              status === f.value
                ? "bg-brand text-white"
                : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        {matches.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-400">Aucune demande de jumelage.</div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Homme (♂)</TH>
                <TH>Femme (♀)</TH>
                <TH>Score</TH>
                <TH>Statut</TH>
                <TH>Sa réponse à lui</TH>
                <TH>Sa réponse à elle</TH>
                <TH>Expiration</TH>
                <TH>Créé le</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {matches.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <div className="font-medium text-neutral-900">{m.maleName}</div>
                    <div className="text-xs text-neutral-400">{m.maleEmail}</div>
                  </TD>
                  <TD>
                    <div className="font-medium text-neutral-900">{m.femaleName}</div>
                    <div className="text-xs text-neutral-400">{m.femaleEmail}</div>
                  </TD>
                  <TD>
                    {m.mutual_pass === false ? (
                      <Badge variant="red">Incompatible</Badge>
                    ) : (
                      <Badge variant="blue">{m.mutual_score ?? "—"}</Badge>
                    )}
                  </TD>
                  <TD>
                    <MatchStatusBadge status={m.status} />
                    {m.status === "ended" && (m.ended_by || m.end_reason) && (
                      <div className="mt-1 max-w-56 text-xs text-neutral-500">
                        {m.ended_by === "mahram"
                          ? "Terminé par le mahram"
                          : m.ended_by === "admin"
                            ? "Terminé par l'admin"
                            : "Terminé"}
                        {m.end_reason && (
                          <div className="mt-0.5 italic text-neutral-400">
                            « {m.end_reason} »
                          </div>
                        )}
                      </div>
                    )}
                  </TD>
                  <TD>
                    <MatchResponseBadge response={m.male_response} />
                  </TD>
                  <TD>
                    <MatchResponseBadge response={m.female_response} />
                  </TD>
                  <TD className="text-xs text-neutral-500">
                    {m.status === "pending" ? timeAgo(m.expires_at) : formatDateTime(m.expires_at)}
                  </TD>
                  <TD className="text-xs text-neutral-500">{formatDateTime(m.created_at)}</TD>
                  <TD className="text-right">
                    {m.status === "pending" && <CancelMatchButton matchId={m.id} />}
                    {m.status === "matched" && <EndMatchButton matchId={m.id} />}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
