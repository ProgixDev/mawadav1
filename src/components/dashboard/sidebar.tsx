"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MessagesSquare,
  CreditCard,
  HeartHandshake,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { fetchUnreadConversationCount } from "@/app/(dashboard)/conversations/actions";

const NAV = [
  { href: "/dashboard", label: "Vue d’ensemble", icon: LayoutDashboard },
  { href: "/users", label: "Utilisateurs", icon: Users },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/subscriptions", label: "Abonnements", icon: CreditCard },
  { href: "/matching", label: "Mise en relation", icon: HeartHandshake },
  { href: "/matches", label: "Correspondances", icon: Heart },
];

export function Sidebar({ unreadConversations = 0 }: { unreadConversations?: number }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(unreadConversations);

  // Keep the Conversations badge in sync with the server-provided initial value
  // whenever the layout re-renders with a fresh count (navigation).
  useEffect(() => {
    setUnread(unreadConversations);
  }, [unreadConversations]);

  // Live inbox badge: re-count clients-with-new-messages on any messages/
  // conversations change. Mirrors the conversations list — the realtime socket
  // is authenticated as the admin so RLS lets the events through, with a polling
  // loop as a safety net. Counts per client, not per message.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function refresh() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetchUnreadConversationCount()
          .then((n) => {
            if (!cancelled) setUnread(n);
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
        .channel("sidebar-inbox")
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, refresh)
        .subscribe();
    }

    subscribe();

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    const poll = setInterval(refresh, 15000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      authSub.unsubscribe();
      if (channel) supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-neutral-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
          M
        </div>
        <span className="font-semibold text-neutral-900">MAWADA Admin</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const badge = href === "/conversations" && unread > 0 ? unread : null;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {badge !== null && (
                <span
                  className={cn(
                    "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                    active ? "bg-white text-brand" : "bg-red-500 text-white",
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
