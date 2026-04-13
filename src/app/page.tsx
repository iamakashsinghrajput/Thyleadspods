"use client";

import { useAuth } from "@/lib/auth-context";
import ProjectTable from "@/components/project-table";
import DashboardHeader from "@/components/dashboard-header";
import StatCards from "@/components/stat-cards";
import PodDashboard from "@/components/pod-dashboard";

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === "pod" && user.podId) {
    return <PodDashboard podId={user.podId} userName={user.name} />;
  }

  return (
    <div className="min-h-full">
      <DashboardHeader />
      <div className="px-8 pb-8 space-y-6">
        <StatCards />
        <ProjectTable />
      </div>
    </div>
  );
}
