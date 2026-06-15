import Link from "next/link";
import { listConversations } from "@/lib/data/conversations";
import { PageHeader } from "@/components/dashboard/page-header";
import { cn } from "@/lib/utils";
import { ConversationsList } from "./conversations-list";

export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "in_contact", label: "In contact" },
  { value: "paused", label: "Paused" },
];

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const conversations = await listConversations(status);

  return (
    <div>
      <PageHeader
        title="Conversations"
        description="Concierge inbox — chat with members and manage their journey"
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/conversations" : `/conversations?status=${f.value}`}
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

      <ConversationsList key={status} initialConversations={conversations} status={status} />
    </div>
  );
}
