"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRow } from "@/lib/types/database";

export type LoginState = { error: string | null };

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "L’adresse courriel et le mot de passe sont requis." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: error?.message ?? "Identifiants invalides." };
  }

  // Enforce admin-only access to the dashboard.
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .single<Pick<UserRow, "role">>();

  if (row?.role !== "admin" && row?.role !== "super_admin") {
    await supabase.auth.signOut();
    return { error: "Ce compte n’est pas un administrateur." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
