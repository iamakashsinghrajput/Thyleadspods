"use client";

import { useMemo } from "react";
import {
  Users,
  Target,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { usePods } from "@/lib/pod-context";
import { useData } from "@/lib/data-context";
import { getExpectedMeetingsToDate } from "@/lib/week-range";

interface StatCardsProps {
  selectedMonth: string;
  selectedYear: number;
}

export default function StatCards({ selectedMonth, selectedYear }: StatCardsProps) {
  const { pods } = usePods();
  const { projects, details } = useData();

  const totalMembers = useMemo(() => {
    const set = new Set<string>();
    for (const pod of pods) for (const m of pod.members) set.add(m.toLowerCase());
    for (const p of projects) for (const m of p.assignedMembers || []) set.add(m.toLowerCase());
    return set.size;
  }, [pods, projects]);

  const projectStats = useMemo(() => {
    if (selectedMonth === "all") return null;
    const stats: Record<string, { completed: number; booked: number }> = {};
    for (const [projectId, list] of Object.entries(details)) {
      const filtered = list.filter((d) => d.month === selectedMonth && d.year === selectedYear);
      stats[projectId] = {
        completed: filtered.filter((d) => d.meetingStatus === "done").length,
        booked: filtered.filter((d) => d.meetingStatus === "scheduled").length,
      };
    }
    return stats;
  }, [details, selectedMonth, selectedYear]);

  const totalProjects = projects.length;
  const totalTarget = projects.reduce((s, p) => s + p.monthlyTargetInternal, 0);
  const totalCompleted = projectStats
    ? projects.reduce((s, p) => s + (projectStats[p.id]?.completed || 0), 0)
    : projects.reduce((s, p) => s + (p.meetingCompleted || 0), 0);
  const avgCompletion = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;
  const atRisk = projects.filter((p) => {
    const expected = getExpectedMeetingsToDate(p.monthlyTargetInternal);
    if (expected === 0) return false;
    const done = projectStats ? (projectStats[p.id]?.completed || 0) : (p.meetingCompleted || 0);
    return Math.round((done / expected) * 100) < 50;
  }).length;

  const cards = [
    {
      label: "Active Members",
      value: totalMembers,
      sub: `${totalProjects} projects`,
      icon: Users,
      accent: "text-[#6800FF]",
      bg: "bg-[#f0e6ff]",
      border: "border-[#e0ccff]",
    },
    {
      label: "Total Targets",
      value: totalTarget.toLocaleString(),
      sub: `${totalCompleted.toLocaleString()} achieved`,
      icon: Target,
      accent: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
    {
      label: "Avg Completion",
      value: `${avgCompletion}%`,
      sub: "across all projects",
      icon: TrendingUp,
      accent: "text-sky-600",
      bg: "bg-sky-50",
      border: "border-sky-100",
    },
    {
      label: "At Risk (this week)",
      value: atRisk,
      sub: "below 50% weekly target",
      icon: AlertTriangle,
      accent: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums tracking-tight">
                  {card.value}
                </p>
                <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${card.bg} border ${card.border}`}>
                <Icon size={18} className={card.accent} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
