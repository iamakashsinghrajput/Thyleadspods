"use client";

import { useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  const { details, projects } = useData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryAs = searchParams.get("as") || "";
  const viewAsMember = queryAs || null;
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toLocaleString("en-US", { month: "long" }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const allMembers = useMemo(() => {
    const m = new Map<string, { firstName: string; podName: string }>();
    for (const pod of pods) {
      for (const member of pod.members) {
        const key = member.split(" ")[0];
        if (!m.has(key.toLowerCase())) m.set(key.toLowerCase(), { firstName: key, podName: pod.name });
      }
    }
    for (const p of projects) {
      for (const member of p.assignedMembers || []) {
        const key = member.split(" ")[0];
        if (!m.has(key.toLowerCase())) m.set(key.toLowerCase(), { firstName: key, podName: "" });
      }
    }
    return Array.from(m.values()).sort((a, b) => a.firstName.localeCompare(b.firstName));
  }, [pods, projects]);

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

  function impersonate(firstName: string | null) {
    if (firstName) {
      router.replace(`/?as=${encodeURIComponent(firstName)}`);
    } else {
      router.replace(`/`);
    }
  }

  if (viewAsMember) {
    const memberPod = pods.find((p) => p.members.some((m) => m.toLowerCase() === viewAsMember.toLowerCase() || m.split(" ")[0].toLowerCase() === viewAsMember.toLowerCase()));
    return (
      <div className="min-h-full">
        <div className="px-8 pt-6 flex items-center justify-between gap-4 flex-wrap">
          <button onClick={() => impersonate(null)} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#6800FF] transition-colors">
            ← Back to Admin Dashboard
          </button>
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-[#6800FF]" />
            <span className="text-xs font-semibold text-[#6800FF]">Viewing as Member</span>
            <select
              value={viewAsMember}
              onChange={(e) => impersonate(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-[#6800FF]/5 border border-[#6800FF]/20 rounded-lg text-[#6800FF] focus:outline-none"
            >
              {allMembers.map((m) => (
                <option key={m.firstName} value={m.firstName}>{m.firstName}{m.podName ? ` · ${m.podName}` : ""}</option>
              ))}
            </select>
          </div>
        </div>
        <PodDashboard podId={memberPod?.id || ""} userName={viewAsMember} impersonateMember={viewAsMember} />
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
        {(user.role === "superadmin" || user.role === "admin") && allMembers.length > 0 && (
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-xs text-slate-400 mt-1.5">View as:</span>
            <div className="flex flex-wrap gap-1.5">
              {allMembers.map((m) => {
                const projectsForMember = projects.filter((p) => (p.assignedMembers || []).some((mm) => mm.toLowerCase() === m.firstName.toLowerCase()));
                const pod = pods.find((pp) => pp.name === m.podName);
                return (
                  <button
                    key={m.firstName}
                    onClick={() => impersonate(m.firstName)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-[#6800FF]/10 hover:text-[#6800FF] text-slate-600 transition-colors group"
                    title={`${m.firstName} — ${projectsForMember.length} project${projectsForMember.length === 1 ? "" : "s"}${m.podName ? ` · ${m.podName}` : ""}`}
                  >
                    {pod && <span className={`w-1.5 h-1.5 rounded-full ${pod.color}`} />}
                    <span>{m.firstName}</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-[#6800FF]/70 tabular-nums">({projectsForMember.length})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <StatCards selectedMonth={selectedMonth} selectedYear={selectedYear} />
        <ProjectTable selectedMonth={selectedMonth} selectedYear={selectedYear} />
      </div>
    </div>
  );
}
