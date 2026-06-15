import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User } from "lucide-react";
import { getConversationDetail } from "@/lib/data/conversations";
import { requireAdmin } from "@/lib/auth";
import { ChatPanel } from "./chat-panel";
import { ConversationControls } from "./conversation-controls";
import { fullName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const detail = await getConversationDetail(id);
  if (!detail) notFound();

  const name = fullName(detail.profile?.first_name, detail.profile?.last_name);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/conversations"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
            {name[0]?.toUpperCase() ?? "?"}
          </span>
          <div>
            <h1 className="font-semibold text-neutral-900">{name}</h1>
            <p className="text-xs text-neutral-500">
              {detail.profile?.gender && (
                <span className="capitalize">{detail.profile.gender} · </span>
              )}
              {[detail.profile?.city, detail.profile?.country].filter(Boolean).join(", ") ||
                detail.user.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/users/${detail.user.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            <User className="h-4 w-4" /> Profile
          </Link>
          <ConversationControls
            conversationId={id}
            current={detail.conversation.admin_status}
          />
        </div>
      </div>

      <ChatPanel
        conversationId={id}
        userId={detail.user.id}
        adminId={admin.id}
        initialMessages={detail.messages}
      />
    </div>
  );
}
