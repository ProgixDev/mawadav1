import { requireAdmin } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { countUnreadConversations } from "@/lib/data/conversations";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const unreadConversations = await countUnreadConversations();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar unreadConversations={unreadConversations} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar admin={admin} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
