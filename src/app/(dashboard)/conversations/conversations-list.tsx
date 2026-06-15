"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminStatusBadge } from "@/components/dashboard/status-badges";
import { fullName, timeAgo, initials } from "@/lib/format";
import { fetchConversations } from "./actions";
import type { ConversationListItem } from "@/lib/data/conversations";

export function ConversationsList({
  initialConversations,
  status,
}: {
  initialConversations: ConversationListItem[];
  status: string;
}) {
  const [conversations, setConversations] = useState(initialConversations);

  // Realtime: any change to `messages` or `conversations` re-runs the same
  // server aggregation the page uses. Refreshes are coalesced so a burst of
  // events triggers a single re-fetch. Mirrors the chat panel — the realtime
  // socket is authenticated as the admin so RLS lets the events through, with a
  // polling loop as a safety net if realtime is unavailable. The parent keys
  // this component by `status`, so it remounts (with fresh data) on filter
  // change and `status` is stable for the component's lifetime.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function refresh() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetchConversations(status === "all" ? undefined : status)
          .then((rows) => {
            if (!cancelled) setConversations(rows);
          })
          .catch(() => {});
      }, 250);
    }

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel("conversations-inbox")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages" },
          refresh,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations" },
          refresh,
        )
        .subscribe();
    }

    subscribe();

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    // Safety-net polling in case realtime is unavailable on this project.
    const poll = setInterval(refresh, 10000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      authSub.unsubscribe();
      if (channel) supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [status]);

  return (
    <Card className="divide-y divide-neutral-100">
      {conversations.length === 0 && (
        <div className="py-12 text-center text-sm text-neutral-400">No conversations.</div>
      )}
      {conversations.map((c) => (
        <Link
          key={c.id}
          href={`/conversations/${c.id}`}
          className="flex items-center gap-4 p-4 hover:bg-neutral-50"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
            {initials(c.firstName, c.lastName, c.userEmail)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-neutral-900">
                {fullName(c.firstName, c.lastName)}
              </p>
              <AdminStatusBadge status={c.admin_status} />
              {c.unreadCount > 0 && <Badge variant="red">{c.unreadCount} new</Badge>}
            </div>
            <p className="truncate text-sm text-neutral-500">
              {c.lastMessageBody ?? "No messages yet"}
            </p>
          </div>
          <span className="shrink-0 text-xs text-neutral-400">
            {timeAgo(c.last_message_at ?? c.created_at)}
          </span>
        </Link>
      ))}
    </Card>
  );
}
