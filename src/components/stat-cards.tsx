"use client";

import {
  Users,
  Target,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { usePods } from "@/lib/pod-context";
import { useData } from "@/lib/data-context";

export default function StatCards() {
  const { pods } = usePods();
  const { projects } = useData();

  const totalProjects = projects.length;
  const totalTarget = projects.reduce((s, p) => s + p.monthlyTargetInternal, 0);
  const totalAchieved = projects.reduce((s, p) => s + p.targetsAchieved, 0);
  const avgCompletion = Math.round((totalAchieved / totalTarget) * 100);
  const atRisk = projects.filter(
    (p) => Math.round((p.targetsAchieved / p.monthlyTargetInternal) * 100) < 50
  ).length;

  const cards = [
    {
      label: "Active Pods",
      value: pods.length,
      sub: `${totalProjects} projects`,
      icon: Users,
      accent: "text-[#6800FF]",
      bg: "bg-[#f0e6ff]",
      border: "border-[#e0ccff]",
    },
    {
      label: "Total Targets",
      value: totalTarget.toLocaleString(),
      sub: `${totalAchieved.toLocaleString()} achieved`,
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
      label: "At Risk",
      value: atRisk,
      sub: "below 50% target",
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
