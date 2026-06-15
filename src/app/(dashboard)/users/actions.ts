"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserStatus } from "@/lib/types/database";

export async function updateUserStatus(userId: string, status: UserStatus) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("users")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
}
