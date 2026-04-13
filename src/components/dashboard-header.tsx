"use client";

import { CalendarDays } from "lucide-react";
import NotificationBell from "@/components/notification-bell";

export default function DashboardHeader() {
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
        <NotificationBell />
      </div>
    </div>
  );
}
