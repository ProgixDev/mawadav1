import Link from "next/link";
import { listUsers } from "@/lib/data/users";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { UserStatusBadge } from "@/components/dashboard/status-badges";
import { UsersToolbar } from "./users-toolbar";
import { fullName, formatDate, initials } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const { items, total, pageSize } = await listUsers({
    search: sp.q,
    status: sp.status,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader title="Users" description={`${total} member${total === 1 ? "" : "s"}`} />

      <UsersToolbar defaultQuery={sp.q ?? ""} defaultStatus={sp.status ?? "all"} />

      <Card className="mt-4 overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Email</TH>
              <TH>Location</TH>
              <TH>Status</TH>
              <TH>Joined</TH>
            </TR>
          </THead>
          <TBody>
            {items.length === 0 && (
              <TR>
                <TD colSpan={5} className="py-10 text-center text-neutral-400">
                  No users found.
                </TD>
              </TR>
            )}
            {items.map((u) => (
              <TR key={u.id} className="cursor-pointer">
                <TD>
                  <Link href={`/users/${u.id}`} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                      {initials(u.first_name, u.last_name, u.email)}
                    </span>
                    <span className="font-medium text-neutral-900">
                      {fullName(u.first_name, u.last_name)}
                      {u.gender && (
                        <span className="ml-2 text-xs font-normal capitalize text-neutral-400">
                          {u.gender}
                        </span>
                      )}
                    </span>
                  </Link>
                </TD>
                <TD>{u.email}</TD>
                <TD>{[u.city, u.country].filter(Boolean).join(", ") || "—"}</TD>
                <TD>
                  <UserStatusBadge status={u.status} />
                </TD>
                <TD>{formatDate(u.created_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <PageLink sp={sp} page={page - 1} disabled={page <= 1} label="Previous" />
            <PageLink sp={sp} page={page + 1} disabled={page >= totalPages} label="Next" />
          </div>
        </div>
      )}
    </div>
  );
}

function PageLink({
  sp,
  page,
  disabled,
  label,
}: {
  sp: { q?: string; status?: string };
  page: number;
  disabled: boolean;
  label: string;
}) {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.status) params.set("status", sp.status);
  params.set("page", String(page));

  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-neutral-200 px-3 py-1.5 text-neutral-300">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/users?${params.toString()}`}
      className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
    >
      {label}
    </Link>
  );
}
