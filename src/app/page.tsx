"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePods } from "@/lib/pod-context";
import { useData } from "@/lib/data-context";
import ProjectTable from "@/components/project-table";
import DashboardHeader from "@/components/dashboard-header";
import StatCards from "@/components/stat-cards";
import PodDashboard from "@/components/pod-dashboard";
import { Eye } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const { pods } = usePods();
  const { details } = useData();
  const [viewAsPod, setViewAsPod] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    Object.values(details).forEach((list) =>
      list.forEach((d) => years.add(d.year))
    );
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [details]);

  if (!user) return null;

  if (user.role === "pod" && user.podId) {
    return <PodDashboard podId={user.podId} userName={user.name} />;
  }

  if (viewAsPod) {
    return (
      <div className="min-h-full">
        <div className="px-8 pt-6 flex items-center justify-between">
          <button onClick={() => setViewAsPod(null)} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#6800FF] transition-colors">
            ← Back to Admin Dashboard
          </button>
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-[#6800FF]" />
            <span className="text-xs font-semibold text-[#6800FF]">Viewing as Pod</span>
            <select
              value={viewAsPod}
              onChange={(e) => setViewAsPod(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-[#6800FF]/5 border border-[#6800FF]/20 rounded-lg text-[#6800FF] focus:outline-none"
            >
              {pods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <PodDashboard podId={viewAsPod} userName={user.name} />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <DashboardHeader
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onFilterChange={(month, year) => { setSelectedMonth(month); setSelectedYear(year); }}
        availableYears={availableYears}
      />
      <div className="px-8 pb-8 space-y-6">
        {user.role === "superadmin" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">View as:</span>
            {pods.map((p) => (
              <button
                key={p.id}
                onClick={() => setViewAsPod(p.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-[#6800FF]/10 hover:text-[#6800FF] text-slate-600 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
        <StatCards selectedMonth={selectedMonth} selectedYear={selectedYear} />
        <ProjectTable selectedMonth={selectedMonth} selectedYear={selectedYear} />
      </div>
    </div>
  );
}
