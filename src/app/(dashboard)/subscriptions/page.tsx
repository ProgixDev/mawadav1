import Link from "next/link";
import { listSubscriptions } from "@/lib/data/subscriptions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { SubscriptionStatusBadge } from "@/components/dashboard/status-badges";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "expired", label: "Expired" },
  { value: "canceled", label: "Canceled" },
];

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const subs = await listSubscriptions(status);

  return (
    <div>
      <PageHeader title="Subscriptions" description="RevenueCat entitlements" />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/subscriptions" : `/subscriptions?status=${f.value}`}
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

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Entitlement</TH>
              <TH>Status</TH>
              <TH>Store</TH>
              <TH>Renews</TH>
              <TH>Expires</TH>
            </TR>
          </THead>
          <TBody>
            {subs.length === 0 && (
              <TR>
                <TD colSpan={6} className="py-10 text-center text-neutral-400">
                  No subscriptions.
                </TD>
              </TR>
            )}
            {subs.map((s) => (
              <TR key={s.id}>
                <TD>
                  <Link href={`/users/${s.user_id}`} className="font-medium text-neutral-900 hover:underline">
                    {s.userEmail ?? s.user_id}
                  </Link>
                </TD>
                <TD>{s.entitlement ?? "—"}</TD>
                <TD>
                  <SubscriptionStatusBadge status={s.status} />
                </TD>
                <TD className="capitalize">{s.store ?? "—"}</TD>
                <TD>{formatDate(s.renews_at)}</TD>
                <TD>{formatDate(s.expires_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
