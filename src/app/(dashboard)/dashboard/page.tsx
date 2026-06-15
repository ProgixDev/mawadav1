import { Users, MessagesSquare, CreditCard } from "lucide-react";
import { getDashboardStats } from "@/lib/data/stats";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  SignupsChart,
  DonutChart,
  StatusBarChart,
  ChartLegend,
} from "@/components/dashboard/charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div>
      <PageHeader title="Overview" description="Key metrics across the platform" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total users"
          value={stats.totalUsers}
          icon={Users}
          accent="brand"
          hint={`${stats.activeUsers} active · ${stats.onboardingUsers} onboarding`}
        />
        <StatCard
          label="Active subscriptions"
          value={stats.activeSubscriptions}
          icon={CreditCard}
          accent="blue"
          hint={`${stats.trialSubscriptions} on trial`}
        />
        <StatCard
          label="Conversations"
          value={stats.totalConversations}
          icon={MessagesSquare}
          accent="brand"
          hint={`${stats.openConversations} new / unassigned`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>New sign-ups (last 14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <SignupsChart data={stats.signupsByDay} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users by status</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={stats.usersByStatus} />
            <ChartLegend data={stats.usersByStatus} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Gender split</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={stats.genderSplit} />
            <ChartLegend data={stats.genderSplit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBarChart data={stats.subscriptionsByStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversations by stage</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBarChart data={stats.conversationsByAdminStatus} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
