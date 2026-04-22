"use client";

import { CalendarDays } from "lucide-react";
import NotificationBell from "@/components/notification-bell";

const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DashboardHeaderProps {
  selectedMonth: string;
  selectedYear: number;
  onFilterChange: (month: string, year: number) => void;
  availableYears: number[];
}

export default function DashboardHeader({ selectedMonth, selectedYear, onFilterChange, availableYears }: DashboardHeaderProps) {
  const today = new Date();
  const formatted = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="px-8 pt-8 pb-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[#6800FF] tracking-wide uppercase mb-1">
            Admin Dashboard
          </p>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Project Overview
          </h1>
          <div className="flex items-center gap-2 mt-2 text-slate-500">
            <CalendarDays size={14} />
            <span className="text-sm">{formatted}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-sm">
            <CalendarDays size={16} className="text-[#6800FF]" />
            <select
              value={selectedMonth}
              onChange={(e) => onFilterChange(e.target.value, selectedYear)}
              className="text-sm font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">All Months</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {selectedMonth !== "all" && (
              <select
                value={selectedYear}
                onChange={(e) => onFilterChange(selectedMonth, Number(e.target.value))}
                className="text-sm font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>
          <NotificationBell />
        </div>
      </div>
    </div>
  );
}
