"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, UserStatus } from "@/lib/types/database";

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

// Change a user's role. Granting or revoking the SUPER-ADMIN role is restricted
// to super admins; all other role changes (user <-> admin) require an admin.
// The `mahram` role is assigned automatically when a mahram links their account,
// so it is not offered here.
export async function setUserRole(userId: string, role: UserRole) {
  const involvesSuperAdmin = role === "super_admin";

  // Read the current role so demoting AWAY from super_admin is also gated.
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("users")
    .select("role")
    .eq("id", userId)
    .single<{ role: UserRole }>();

  if (involvesSuperAdmin || current?.role === "super_admin") {
    await requireSuperAdmin();
  } else {
    await requireAdmin();
  }

  const { error } = await admin
    .from("users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath(`/users/${userId}`);
  revalidatePath("/users");
}
