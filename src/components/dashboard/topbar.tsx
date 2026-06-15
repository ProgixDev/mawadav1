import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
import type { UserRow } from "@/lib/types/database";

export function Topbar({ admin }: { admin: UserRow }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-5">
      <div className="md:hidden flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">
          M
        </div>
        <span className="font-semibold text-neutral-900">MAWADA</span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-neutral-900">{admin.email}</p>
          <p className="text-xs text-neutral-500">Administrator</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
