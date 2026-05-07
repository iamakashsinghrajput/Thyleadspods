"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ArrowRight,
  Target,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { usePods } from "@/lib/pod-context";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { resolveProjectLogo } from "@/lib/client-logo";
import { isInCurrentWeek } from "@/lib/week-range";
import NotificationBell from "@/components/notification-bell";

const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PodDashboard({ podId, userName, impersonateMember }: { podId: string; userName: string; impersonateMember?: string }) {
  const { podMap } = usePods();
  const { projects, details, metrics } = useData();
  const { user } = useAuth();

  const [selectedMonth, setSelectedMonth] = useState<string>(() => MONTH_OPTIONS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  const pod = podMap[podId];
  const podMemberSet = useMemo(() => {
    if (!pod) return new Set<string>();
    return new Set(pod.members.map((m) => m.toLowerCase()));
  }, [pod]);

  const isImpersonating = !!impersonateMember;
  const viewerFirstName = (impersonateMember || user?.name || userName || "").split(" ")[0].toLowerCase();
  const isPodViewer = isImpersonating || user?.role === "pod";

  const podProjects = useMemo(() => {
    if (isPodViewer && viewerFirstName) {
      return projects.filter((p) => {
        const assigned = p.assignedMembers || [];
        if (assigned.length > 0) {
          return assigned.some((m) => m.toLowerCase() === viewerFirstName);
        }
        return podId ? p.assignedPod === podId : false;
      });
    }
    return projects.filter((p) => {
      if (p.assignedPod === podId) return true;
      const assigned = p.assignedMembers || [];
      return assigned.some((m) => podMemberSet.has(m.toLowerCase()));
    });
  }, [projects, podId, podMemberSet, isPodViewer, viewerFirstName]);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    Object.values(details).forEach((list) => list.forEach((d) => years.add(d.year)));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [details]);

  const completedByProject: Record<string, number> = {};
  for (const p of podProjects) {
    completedByProject[p.id] = (details[p.id] ?? []).filter(
      (d) => d.meetingStatus === "done" && d.month === selectedMonth && d.year === selectedYear
    ).length;
  }

  const totalTarget = podProjects.reduce((s, p) => s + p.monthlyTargetInternal, 0);
  const totalCompleted = podProjects.reduce((s, p) => s + (completedByProject[p.id] || 0), 0);
  const avgCompletion = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;
  const atRisk = podProjects.filter((p) => {
    const t = p.weeklyTargetExternal > 0 ? p.weeklyTargetExternal : (p.monthlyTargetInternal > 0 ? Math.ceil(p.monthlyTargetInternal / 4) : 0);
    if (t === 0) return false;
    let weekDone = 0;
    for (const d of details[p.id] || []) {
      if (d.meetingStatus === "done" && isInCurrentWeek(d.meetingDate)) weekDone++;
    }
    return Math.round((weekDone / t) * 100) < 50;
  }).length;

  const weeklyDoneByProject = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [projectId, list] of Object.entries(details)) {
      let count = 0;
      for (const d of list) {
        if (d.meetingStatus === "done" && isInCurrentWeek(d.meetingDate)) count++;
      }
      out[projectId] = count;
    }
    return out;
  }, [details]);

  function getWeeklyTarget(p: typeof podProjects[0]): number {
    if (p.weeklyTargetExternal > 0) return p.weeklyTargetExternal;
    if (p.monthlyTargetInternal > 0) return Math.ceil(p.monthlyTargetInternal / 4);
    return 0;
  }

  function getHealth(p: typeof podProjects[0]) {
    const target = getWeeklyTarget(p);
    if (target === 0) return { color: "bg-slate-400", label: "N/A" };
    const pct = Math.round(((weeklyDoneByProject[p.id] || 0) / target) * 100);
    if (pct >= 75) return { color: "bg-emerald-500", label: "On Track" };
    if (pct >= 50) return { color: "bg-amber-400", label: "Needs Attention" };
    return { color: "bg-red-500", label: "At Risk" };
  }

  return (
    <div className="min-h-full">
      <div className="px-8 pt-8 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[#6800FF] tracking-wide uppercase mb-1">
              {isImpersonating ? `${impersonateMember}'s Workspace` : isPodViewer ? "Member Workspace" : `${pod?.name ?? "Team"} Workspace`}
            </p>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Welcome, {userName}
            </h1>
            <div className="flex items-center gap-2 mt-2 text-slate-500">
              <CalendarDays size={14} />
              <span className="text-sm">{today}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-sm">
              <CalendarDays size={16} className="text-[#6800FF]" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-sm font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <NotificationBell />
          </div>
        </div>
      </div>

      <div className="px-8 pb-8 mt-4 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clients</p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{podProjects.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-emerald-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Target</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{totalTarget}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-sky-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Completion</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{avgCompletion}%</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">At Risk</p>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{atRisk}</p>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-800">{isPodViewer ? "Your Clients" : "Assigned Clients"}</h2>
            {isPodViewer && (
              <p className="text-[11px] text-slate-500">Showing clients you&apos;re personally assigned to. Clients without explicit member assignments fall back to your team.</p>
            )}
          </div>

          {podProjects.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-16 text-center">
              <Building2 size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No clients assigned yet</p>
              <p className="text-slate-400 text-sm mt-1">Ask your admin to assign projects</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {podProjects.map((project) => {
                const health = getHealth(project);
                const completed = completedByProject[project.id] || 0;
                const pct = project.monthlyTargetInternal > 0 ? Math.round((completed / project.monthlyTargetInternal) * 100) : 0;
                const detailCount = details[project.id]?.length ?? 0;
                const metricDays = metrics[project.id]?.reduce((s, m) => s + m.dailyMetrics.length, 0) ?? 0;

                return (
                  <Link
                    key={project.id}
                    href={`/client/${project.id}`}
                    className="bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all p-5 group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <ClientLogo project={project} />
                        <div>
                          <p className="font-semibold text-slate-900 group-hover:text-[#6800FF] transition-colors">{project.clientName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{project.clientId}</p>
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-[#6800FF] transition-colors mt-1" />
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-500">Completion</span>
                          <span className="font-semibold text-slate-700">{pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${health.color}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${health.color}`} />
                          <span className="text-xs text-slate-500">{health.label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{detailCount} contacts</span>
                          <span>{metricDays} metric days</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Target</p>
                          <p className="text-sm font-semibold text-slate-700 tabular-nums">{project.monthlyTargetInternal}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Achieved</p>
                          <p className="text-sm font-semibold text-slate-700 tabular-nums">{completed}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Ext Target</p>
                          <p className="text-sm font-semibold text-slate-700 tabular-nums">{project.monthlyTargetExternal}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientLogo({ project }: { project: { clientName: string; websiteUrl?: string; logoUrl?: string } }) {
  const [broken, setBroken] = useState(false);
  const src = resolveProjectLogo(project);
  if (!src || broken) {
    return (
      <div className="w-10 h-10 rounded-lg bg-[#f0e6ff] border border-[#e0ccff] flex items-center justify-center text-[#6800FF] shrink-0">
        <Building2 size={20} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={project.clientName}
      onError={() => setBroken(true)}
      className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200 shrink-0"
    />
  );
}
