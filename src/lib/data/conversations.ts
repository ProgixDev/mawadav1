import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ConversationRow,
  MessageRow,
  ProfileRow,
  UserRow,
} from "@/lib/types/database";

export interface ConversationListItem extends ConversationRow {
  userEmail: string;
  firstName: string | null;
  lastName: string | null;
  lastMessageBody: string | null;
  unreadCount: number;
}

export async function listConversations(
  adminStatus?: string,
): Promise<ConversationListItem[]> {
  const admin = createAdminClient();

  let q = admin
    .from("conversations")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (adminStatus && adminStatus !== "all") q = q.eq("admin_status", adminStatus);

  const { data: convs } = await q;
  const conversations = (convs ?? []) as ConversationRow[];
  if (conversations.length === 0) return [];

  const userIds = conversations.map((c) => c.user_id);
  const convIds = conversations.map((c) => c.id);

  const [{ data: users }, { data: profiles }, { data: messages }] = await Promise.all([
    admin.from("users").select("id, email").in("id", userIds),
    admin.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds),
    admin
      .from("messages")
      .select("conversation_id, body, sender_id, read_at, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false }),
  ]);

  const emailById = new Map((users ?? []).map((u) => [u.id, u.email as string]));
  const profileById = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p as Pick<ProfileRow, "first_name" | "last_name" | "user_id">]),
  );

  const lastBody = new Map<string, string>();
  const unread = new Map<string, number>();
  for (const m of messages ?? []) {
    const cid = m.conversation_id as string;
    if (!lastBody.has(cid)) lastBody.set(cid, m.body as string);
    // Unread for admin = messages from the user (not the admin) that are unread.
    const conv = conversations.find((c) => c.id === cid);
    if (conv && m.sender_id === conv.user_id && !m.read_at) {
      unread.set(cid, (unread.get(cid) ?? 0) + 1);
    }
  }

  return conversations.map((c) => ({
    ...c,
    userEmail: emailById.get(c.user_id) ?? "",
    firstName: profileById.get(c.user_id)?.first_name ?? null,
    lastName: profileById.get(c.user_id)?.last_name ?? null,
    lastMessageBody: lastBody.get(c.id) ?? null,
    unreadCount: unread.get(c.id) ?? 0,
  }));
}

// Inbox badge: number of *clients* (conversations) that have at least one
// unread message from the member — counted per conversation, NOT per message.
// So a client who sent five unread messages counts once.
export async function countUnreadConversations(): Promise<number> {
  const admin = createAdminClient();

  const { data: convs } = await admin
    .from("conversations")
    .select("id, user_id")
    .limit(1000);
  const conversations = (convs ?? []) as Pick<ConversationRow, "id" | "user_id">[];
  if (conversations.length === 0) return 0;

  const userById = new Map(conversations.map((c) => [c.id, c.user_id]));

  const { data: messages } = await admin
    .from("messages")
    .select("conversation_id, sender_id, read_at")
    .in("conversation_id", Array.from(userById.keys()))
    .is("read_at", null);

  const withUnread = new Set<string>();
  for (const m of messages ?? []) {
    const cid = m.conversation_id as string;
    // Only the member's own messages count as unread for the admin.
    if (m.sender_id === userById.get(cid)) withUnread.add(cid);
  }
  return withUnread.size;
}

export interface ConversationDetail {
  conversation: ConversationRow;
  user: Pick<UserRow, "id" | "email" | "status">;
  profile: Pick<ProfileRow, "first_name" | "last_name" | "gender" | "city" | "country"> | null;
  messages: MessageRow[];
}

export async function getConversationDetail(
  conversationId: string,
): Promise<ConversationDetail | null> {
  const admin = createAdminClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle<ConversationRow>();
  if (!conv) return null;

  const [{ data: user }, { data: profile }, { data: messages }] = await Promise.all([
    admin
      .from("users")
      .select("id, email, status")
      .eq("id", conv.user_id)
      .maybeSingle<Pick<UserRow, "id" | "email" | "status">>(),
    admin
      .from("profiles")
      .select("first_name, last_name, gender, city, country")
      .eq("user_id", conv.user_id)
      .maybeSingle<Pick<ProfileRow, "first_name" | "last_name" | "gender" | "city" | "country">>(),
    admin
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  ]);

  if (!user) return null;

  return {
    conversation: conv,
    user,
    profile: profile ?? null,
    messages: (messages ?? []) as MessageRow[],
  };
}
