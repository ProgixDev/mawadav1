import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getAdminUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
            M
          </div>
          <h1 className="text-xl font-semibold text-neutral-900">MAWADA Admin</h1>
          <p className="mt-1 text-sm text-neutral-500">Sign in to the admin dashboard</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
