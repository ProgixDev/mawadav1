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
      <PageHeader title="Vue d’ensemble" description="Indicateurs clés de la plateforme" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total des utilisateurs"
          value={stats.totalUsers}
          icon={Users}
          accent="brand"
          hint={`${stats.activeUsers} actifs · ${stats.onboardingUsers} en intégration`}
        />
        <StatCard
          label="Abonnements actifs"
          value={stats.activeSubscriptions}
          icon={CreditCard}
          accent="blue"
          hint={`${stats.trialSubscriptions} en période d’essai`}
        />
        <StatCard
          label="Conversations"
          value={stats.totalConversations}
          icon={MessagesSquare}
          accent="brand"
          hint={`${stats.openConversations} nouvelles / non attribuées`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nouvelles inscriptions (14 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent>
            <SignupsChart data={stats.signupsByDay} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs par statut</CardTitle>
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
            <CardTitle>Répartition par genre</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={stats.genderSplit} />
            <ChartLegend data={stats.genderSplit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abonnements</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBarChart data={stats.subscriptionsByStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversations par étape</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBarChart data={stats.conversationsByAdminStatus} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
