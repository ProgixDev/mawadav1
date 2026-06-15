"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listConversations, type ConversationListItem } from "@/lib/data/conversations";
import type { AdminStatus, MessageRow, MessageModerationStatus } from "@/lib/types/database";

// Used by the conversations list as a realtime refresh: re-runs the same
// server-side aggregation (last message, unread counts, joined profiles) the
// page renders initially, so the inbox stays live as messages arrive.
export async function fetchConversations(
  status?: string,
): Promise<ConversationListItem[]> {
  await requireAdmin();
  return listConversations(status);
}

// Admin sends a message into a user's conversation. Uses the service-role client
// so it works regardless of the user-scoped RLS. Also claims the conversation
// (sets admin_id + moves it to "in_contact") on first admin reply.
export async function sendAdminMessage(
  conversationId: string,
  body: string,
): Promise<MessageRow> {
  const adminUser = await requireAdmin();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message is empty.");

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: message, error } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: adminUser.id,
      body: trimmed,
      moderation_status: "ok",
    })
    .select("*")
    .single<MessageRow>();
  if (error || !message) throw new Error(error?.message ?? "Failed to send.");

  await admin
    .from("conversations")
    .update({
      admin_id: adminUser.id,
      admin_status: "in_contact",
      last_message_at: now,
      updated_at: now,
    })
    .eq("id", conversationId);

  revalidatePath(`/conversations/${conversationId}`);
  revalidatePath("/conversations");
  return message;
}

export async function setAdminStatus(conversationId: string, status: AdminStatus) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from("conversations")
    .update({ admin_status: status, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  revalidatePath(`/conversations/${conversationId}`);
  revalidatePath("/conversations");
}

// Mark all of the user's messages in this conversation as read by the admin.
export async function markConversationRead(conversationId: string, userId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("sender_id", userId)
    .is("read_at", null);
  revalidatePath("/conversations");
}

// Used by the chat panel as a realtime fallback / refresh.
export async function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []) as MessageRow[];
}

export async function setMessageModeration(
  messageId: string,
  conversationId: string,
  status: MessageModerationStatus,
) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("messages").update({ moderation_status: status }).eq("id", messageId);
  revalidatePath(`/conversations/${conversationId}`);
}
