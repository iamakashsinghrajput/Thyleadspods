"use client";

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
import NotificationBell from "@/components/notification-bell";

export default function PodDashboard({ podId, userName }: { podId: string; userName: string }) {
  const { podMap } = usePods();
  const { projects, details, metrics } = useData();

  const pod = podMap[podId];
  const podProjects = projects.filter((p) => p.assignedPod === podId);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const totalTarget = podProjects.reduce((s, p) => s + p.monthlyTargetInternal, 0);
  const totalAchieved = podProjects.reduce((s, p) => s + p.targetsAchieved, 0);
  const avgCompletion = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
  const atRisk = podProjects.filter((p) => p.monthlyTargetInternal > 0 && Math.round((p.targetsAchieved / p.monthlyTargetInternal) * 100) < 50).length;

  function getHealth(p: typeof podProjects[0]) {
    if (p.monthlyTargetInternal === 0) return { color: "bg-slate-400", label: "N/A" };
    const pct = Math.round((p.targetsAchieved / p.monthlyTargetInternal) * 100);
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
              {pod?.name ?? "Pod"} Workspace
            </p>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Welcome, {userName}
            </h1>
            <div className="flex items-center gap-2 mt-2 text-slate-500">
              <CalendarDays size={14} />
              <span className="text-sm">{today}</span>
            </div>
          </div>
          <NotificationBell />
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
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Assigned Clients</h2>

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
                const pct = project.monthlyTargetInternal > 0 ? Math.round((project.targetsAchieved / project.monthlyTargetInternal) * 100) : 0;
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
                        <div className="w-10 h-10 rounded-lg bg-[#f0e6ff] border border-[#e0ccff] flex items-center justify-center text-[#6800FF] shrink-0">
                          <Building2 size={20} />
                        </div>
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
                          <p className="text-sm font-semibold text-slate-700 tabular-nums">{project.targetsAchieved}</p>
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
