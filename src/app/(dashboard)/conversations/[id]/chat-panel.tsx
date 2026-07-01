"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  sendAdminMessage,
  markConversationRead,
  fetchMessages,
  setMessageModeration,
  translateMessage,
} from "../actions";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ModerationBadge } from "@/components/dashboard/status-badges";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MessageRow } from "@/lib/types/database";

export function ChatPanel({
  conversationId,
  userId,
  adminId,
  initialMessages,
}: {
  conversationId: string;
  userId: string;
  adminId: string;
  initialMessages: MessageRow[];
}) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  // On-demand translations keyed by message id. `shown` toggles between the
  // original and its French translation; `text`/`error` are cached so a second
  // click never re-calls Gemini.
  type Translation = { loading?: boolean; text?: string; error?: string; shown: boolean };
  const [translations, setTranslations] = useState<Record<string, Translation>>({});

  function handleTranslate(m: MessageRow) {
    const existing = translations[m.id];
    // Already fetched → just toggle visibility.
    if (existing?.text || existing?.error) {
      setTranslations((t) => ({ ...t, [m.id]: { ...existing, shown: !existing.shown } }));
      return;
    }
    if (existing?.loading) return;
    setTranslations((t) => ({ ...t, [m.id]: { loading: true, shown: true } }));
    translateMessage(m.body)
      .then((res) => {
        setTranslations((t) => ({
          ...t,
          [m.id]: res.ok
            ? { text: res.text, shown: true }
            : { error: res.error, shown: true },
        }));
      })
      .catch(() => {
        setTranslations((t) => ({
          ...t,
          [m.id]: { error: "Traduction indisponible.", shown: true },
        }));
      });
  }

  function mergeMessages(incoming: MessageRow[]) {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return Array.from(byId.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    });
  }

  // Mark the user's messages as read when the conversation opens.
  useEffect(() => {
    markConversationRead(conversationId, userId).catch(() => {});
  }, [conversationId, userId]);

  // Realtime subscription. Postgres-changes events are filtered by RLS, so the
  // realtime socket MUST be authenticated as the admin — otherwise the admin-only
  // SELECT policies on `messages` silently drop every event. We set the auth token
  // before subscribing and re-set it whenever the session refreshes. A short
  // polling loop stays as a safety net if realtime is unavailable.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function subscribe() {
      // Authenticate the realtime connection with the admin's access token so
      // RLS evaluates the admin policies (not the anon role).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as MessageRow;
            if (row?.id) mergeMessages([row]);
            if (row?.sender_id === userId) {
              markConversationRead(conversationId, userId).catch(() => {});
            }
          },
        )
        .subscribe();
    }

    subscribe();

    // Keep the realtime socket authenticated after a token refresh.
    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    // Safety-net polling in case realtime is unavailable on this project.
    const poll = setInterval(() => {
      fetchMessages(conversationId).then(mergeMessages).catch(() => {});
    }, 5000);

    return () => {
      cancelled = true;
      authSub.unsubscribe();
      if (channel) supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [conversationId, userId]);

  // Auto-scroll on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = body.trim();
    if (!text || pending) return;
    setBody("");
    startTransition(async () => {
      try {
        const sent = await sendAdminMessage(conversationId, text);
        mergeMessages([sent]);
      } catch {
        setBody(text); // restore on failure
      }
    });
  }

  function toggleModeration(m: MessageRow) {
    const next = m.moderation_status === "removed" ? "ok" : "removed";
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, moderation_status: next } : x)),
    );
    setMessageModeration(m.id, conversationId, next).catch(() => {});
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-400">
            Aucun message pour le moment. Dites salam 👋
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === adminId;
          const removed = m.moderation_status === "removed";
          const tr = translations[m.id];
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("group max-w-[75%]", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2 text-sm",
                    mine
                      ? "bg-brand text-white rounded-br-sm"
                      : "bg-neutral-100 text-neutral-800 rounded-bl-sm",
                    removed && "opacity-50 line-through",
                  )}
                >
                  {m.body}
                </div>
                {!mine && tr?.shown && (tr.text || tr.error) && (
                  <div
                    className={cn(
                      "mt-1 rounded-2xl rounded-bl-sm border px-4 py-2 text-sm",
                      tr.error
                        ? "border-red-100 bg-red-50 text-red-600"
                        : "border-brand/15 bg-brand/5 text-neutral-700",
                    )}
                  >
                    {tr.error ?? tr.text}
                  </div>
                )}
                <div
                  className={cn(
                    "mt-1 flex items-center gap-2 text-[11px] text-neutral-400",
                    mine ? "justify-end" : "justify-start",
                  )}
                >
                  <span>{formatDateTime(m.created_at)}</span>
                  {m.moderation_status !== "ok" && (
                    <ModerationBadge status={m.moderation_status} />
                  )}
                  {!mine && (
                    <>
                      <button
                        onClick={() => handleTranslate(m)}
                        disabled={tr?.loading}
                        className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-brand disabled:opacity-60 disabled:group-hover:opacity-60"
                      >
                        {tr?.loading
                          ? "Traduction…"
                          : tr?.shown && (tr.text || tr.error)
                            ? "Voir l’original"
                            : tr?.text || tr?.error
                              ? "Voir la traduction"
                              : "Traduire"}
                      </button>
                      <button
                        onClick={() => toggleModeration(m)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600"
                      >
                        {removed ? "Restaurer" : "Retirer"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-neutral-200 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Écrire une réponse…  (Entrée pour envoyer, Maj+Entrée pour un saut de ligne)"
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button onClick={handleSend} disabled={pending || !body.trim()} size="icon" className="h-11 w-11 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
