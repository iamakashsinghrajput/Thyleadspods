"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { LogOut, Calendar, CheckCircle2, Clock, MessageSquare, X, Mail, Phone, User, Building2, Globe, Video, Loader2, Search } from "lucide-react";
import Image from "next/image";
import type { ClientDetail } from "@/lib/client-data";

interface RemarkData {
  remark: string;
  updatedAt: string;
  updatedBy: string;
}

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function parseMonthKey(m: { month: string; year: number }): string {
  return `${m.month} ${m.year}`;
}

// Known client → domain map. Clearbit's logo API needs an exact domain;
// well-known companies below resolve reliably. Anything missing falls through
// to a lowercased-name guess, and if that fails, the initial-letter avatar.
const CLIENT_LOGO_DOMAINS: Record<string, string> = {
  thyleads: "thyleads.com",
  clevertap: "clevertap.com",
  bluedove: "bluedove.co",
  evality: "evality.ai",
  onecap: "onecap.in",
  mynd: "myndsol.com",
  actyv: "actyv.ai",
  zigtal: "zigtal.com",
  vwo: "vwo.com",
  pazo: "pazo.co.in",
  venwiz: "venwiz.com",
  infeedo: "infeedo.ai",
};

function clientLogoDomain(name: string): string | null {
  if (!name) return null;
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return CLIENT_LOGO_DOMAINS[key] || `${key}.com`;
}

function ClientLogo({ name, size = 56 }: { name: string; size?: number }) {
  const domain = clientLogoDomain(name);
  // Try multiple logo providers in order. Clearbit sometimes 404s after its
  // HubSpot acquisition; Google's s2/favicons endpoint always resolves because
  // it can fall back to a rendered letter icon from the live site. If everything
  // fails we render a gradient initial avatar.
  const sources = domain
    ? [
        `https://logo.clearbit.com/${domain}`,
        `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      ]
    : [];
  const [srcIdx, setSrcIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const showFallback = sources.length === 0 || failed;

  if (showFallback) {
    return (
      <div
        className="rounded-2xl bg-gradient-to-br from-[#6800FF] to-[#4a00b8] text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-[#6800FF]/20"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      >
        {initial}
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm overflow-hidden"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sources[srcIdx]}
        alt={name}
        onError={() => {
          if (srcIdx < sources.length - 1) setSrcIdx(srcIdx + 1);
          else setFailed(true);
        }}
        className="w-full h-full object-contain"
        style={{ padding: Math.max(4, Math.round(size * 0.12)) }}
      />
    </div>
  );
}

function monthSortKey(s: string): number {
  const [mo, yr] = s.split(" ");
  const idx = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(mo);
  return Number(yr) * 12 + idx;
}

function fmtRelative(d: string) {
  if (!d) return "";
  const now = Date.now();
  const then = new Date(d).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  done: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Completed" },
  scheduled: { bg: "bg-blue-50", text: "text-blue-700", label: "Scheduled" },
  pipeline: { bg: "bg-amber-50", text: "text-amber-700", label: "Pipeline" },
};

export default function ClientPortal() {
  const { user, logout } = useAuth();
  const { details } = useData();
  const [remarks, setRemarks] = useState<Record<string, RemarkData>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClientDetail | null>(null);
  const [editingRemark, setEditingRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const projectId = user?.projectId || "";
  const meetings: ClientDetail[] = details[projectId] ?? [];

  const fetchRemarks = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/portal/meetings?projectId=${projectId}`);
      const data = await res.json();
      setRemarks(data.remarks || {});
    } catch {}
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchRemarks(); })();
    return () => { ignore = true; };
  }, [fetchRemarks]);

  async function saveRemark() {
    if (!selected || !user) return;
    setSavingRemark(true);
    try {
      const res = await fetch("/api/portal/remark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          meetingId: selected.meetingId,
          remark: editingRemark,
          updatedBy: user.name,
        }),
      });
      const data = await res.json();
      setRemarks((prev) => ({
        ...prev,
        [selected.meetingId]: { remark: data.remark, updatedAt: data.updatedAt, updatedBy: data.updatedBy },
      }));
    } catch {}
    setSavingRemark(false);
  }

  function openMeeting(m: ClientDetail) {
    setSelected(m);
    setEditingRemark(remarks[m.meetingId]?.remark || "");
  }

  if (!user) return null;

  const months = [...new Set(meetings.map((m) => `${m.month} ${m.year}`))];
  const now = new Date();
  const currentMonth = now.toLocaleDateString("en-US", { month: "long" });
  const currentYear = now.getFullYear();
  const thisMonthMeetings = meetings.filter((m) => m.month === currentMonth && m.year === currentYear);

  const filtered = meetings.filter((m) => {
    if (statusFilter !== "all" && m.meetingStatus !== statusFilter) return false;
    if (monthFilter !== "all" && `${m.month} ${m.year}` !== monthFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.companyName.toLowerCase().includes(q) || m.contactName.toLowerCase().includes(q) || m.meetingId.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    // Newest meetings first. Fall back to time, then meeting ID for stable ordering.
    const dateCmp = (b.meetingDate || "").localeCompare(a.meetingDate || "");
    if (dateCmp !== 0) return dateCmp;
    const timeCmp = (b.meetingTime || "").localeCompare(a.meetingTime || "");
    if (timeCmp !== 0) return timeCmp;
    const numA = parseInt(a.meetingId.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.meetingId.replace(/\D/g, ""), 10) || 0;
    return numB - numA;
  });

  const meetingsWithRemarks = filtered.filter((m) => remarks[m.meetingId]?.remark);

  const scheduledCount = meetings.filter((m) => m.meetingStatus === "scheduled").length;
  const pipelineCount = meetings.filter((m) => m.meetingStatus === "pipeline").length;
  const doneCount = meetings.filter((m) => m.meetingStatus === "done").length;

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const upcomingMeetings = meetings
    .filter((m) => m.meetingStatus === "scheduled" && m.meetingDate && m.meetingDate >= todayStr)
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate) || (a.meetingTime || "").localeCompare(b.meetingTime || ""))
    .slice(0, 4);

  const recentRemarkItems = Object.entries(remarks)
    .filter(([, r]) => r.remark)
    .map(([meetingId, r]) => {
      const meeting = meetings.find((m) => m.meetingId === meetingId);
      return meeting ? { meeting, remark: r } : null;
    })
    .filter((x): x is { meeting: ClientDetail; remark: RemarkData } => x !== null)
    .sort((a, b) => new Date(b.remark.updatedAt).getTime() - new Date(a.remark.updatedAt).getTime())
    .slice(0, 3);

  const teamMap = new Map<string, { name: string; role: string; count: number }>();
  for (const m of meetings) {
    if (m.salesRep) {
      const k = `rep:${m.salesRep}`;
      const prev = teamMap.get(k);
      teamMap.set(k, { name: m.salesRep, role: "Thyleads Rep", count: (prev?.count || 0) + 1 });
    }
    if (m.accountManager) {
      const k = `am:${m.accountManager}`;
      const prev = teamMap.get(k);
      teamMap.set(k, { name: m.accountManager, role: "Account Manager", count: (prev?.count || 0) + 1 });
    }
  }
  const teamMembers = Array.from(teamMap.values()).sort((a, b) => b.count - a.count).slice(0, 4);

  // Group filtered meetings by month for the timeline list
  const groupedByMonth = filtered.reduce<Record<string, ClientDetail[]>>((acc, m) => {
    const key = parseMonthKey(m);
    (acc[key] ||= []).push(m);
    return acc;
  }, {});
  const monthGroupKeys = Object.keys(groupedByMonth).sort((a, b) => monthSortKey(b) - monthSortKey(a));

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="w-full px-6 lg:px-10 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Thyleads" width={28} height={28} className="rounded-lg" />
            <span className="text-[13px] font-bold text-slate-900">Thyleads</span>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Client Portal</span>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      <div className="w-full px-6 lg:px-10 py-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 mb-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <ClientLogo name={user.name} size={56} />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Welcome back</p>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight truncate mt-0.5">{user.name}</h1>
                <p className="text-xs text-slate-500 mt-0.5">{meetings.length} total meetings recorded on your portal</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 lg:gap-5 shrink-0 lg:border-l border-slate-100 lg:pl-6">
              <div className="text-center lg:text-left">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">This month</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">{thisMonthMeetings.length}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{currentMonth.slice(0, 3)} {currentYear}</p>
              </div>
              <div className="text-center lg:text-left">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Completed</p>
                <p className="text-2xl font-bold text-emerald-600 tabular-nums mt-0.5">{doneCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">All time</p>
              </div>
              <div className="text-center lg:text-left">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Scheduled</p>
                <p className="text-2xl font-bold text-amber-600 tabular-nums mt-0.5">{scheduledCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Upcoming</p>
              </div>
              <div className="text-center lg:text-left">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Pipeline</p>
                <p className="text-2xl font-bold text-indigo-600 tabular-nums mt-0.5">{pipelineCount}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">In progress</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <h2 className="text-base font-bold text-slate-900">All meetings</h2>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md tabular-nums">{filtered.length}</span>
              </div>
              <div className="flex-1 flex flex-wrap items-center gap-2 md:justify-end">
                <div className="relative flex-1 md:flex-none md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="text" placeholder="Search company, contact, or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10" />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10">
                  <option value="all">All Status</option>
                  <option value="done">Completed</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="pipeline">Pipeline</option>
                </select>
                <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10">
                  <option value="all">All Months</option>
                  {months.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="text-[#6800FF] animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                <Calendar size={22} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No meetings found</p>
              <p className="text-xs text-slate-400 mt-1">{search || statusFilter !== "all" || monthFilter !== "all" ? "Try adjusting your filters" : "Meetings will appear here once scheduled"}</p>
            </div>
          ) : (
            <div className="max-h-110 overflow-y-auto">
              {monthGroupKeys.map((monthKey) => {
                const group = groupedByMonth[monthKey];
                return (
                  <div key={monthKey}>
                    <div className="px-6 py-2.5 bg-slate-50 border-y border-slate-100 flex items-center justify-between sticky top-0 z-10">
                      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{monthKey}</p>
                      <p className="text-[11px] font-semibold text-slate-500 tabular-nums">{group.length} meeting{group.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {group.map((m) => {
                        const st = statusStyle[m.meetingStatus] || statusStyle.pipeline;
                        const dotColor = m.meetingStatus === "done" ? "bg-emerald-500" : m.meetingStatus === "scheduled" ? "bg-blue-500" : "bg-amber-500";
                        const rm = remarks[m.meetingId];
                        const hasRemark = !!rm?.remark;
                        const dateObj = m.meetingDate ? new Date(m.meetingDate) : null;
                        const dayNum = dateObj ? dateObj.getDate() : "—";
                        const monShort = dateObj ? dateObj.toLocaleDateString("en-US", { month: "short" }) : "";
                        const weekday = dateObj ? dateObj.toLocaleDateString("en-US", { weekday: "short" }) : "";
                        return (
                          <button
                            key={m.id}
                            onClick={() => openMeeting(m)}
                            className="w-full px-6 py-4 flex items-start gap-4 text-left hover:bg-slate-50 transition-colors group"
                          >
                            <div className="flex flex-col items-center justify-center w-12 shrink-0 rounded-xl border border-slate-200 bg-white py-1.5 group-hover:border-[#6800FF]/40 transition-colors">
                              <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">{monShort}</span>
                              <span className="text-lg font-bold text-slate-900 leading-none tabular-nums my-0.5">{dayNum}</span>
                              <span className="text-[9px] font-medium text-slate-400 uppercase">{weekday}</span>
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-slate-900 truncate">{m.companyName}</p>
                                {hasRemark && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6800FF] bg-[#6800FF]/5 border border-[#6800FF]/10 px-2 py-0.5 rounded-md">
                                    <MessageSquare size={9} /> Remark
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-1 truncate">
                                {m.contactName}{m.contactTitle ? <span className="text-slate-400"> · {m.contactTitle}</span> : null}
                              </p>
                              {hasRemark && rm && (
                                <p className="text-[10px] text-slate-400 mt-1.5">Updated {fmtRelative(rm.updatedAt)}</p>
                              )}
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${st.bg} ${st.text}`}>
                                <span className={`w-1 h-1 rounded-full ${dotColor}`} />
                                {st.label}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 tabular-nums">
                                <Clock size={11} className="text-slate-400" /> {m.meetingTime || "—"}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">{m.meetingId}</span>
                              {m.meetingLink && (
                                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-[#6800FF] bg-[#6800FF]/5 px-2.5 py-1 rounded-md group-hover:bg-[#6800FF]/10 transition-colors">
                                  <Video size={11} /> Join
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {meetingsWithRemarks.length > 0 && (
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
              <MessageSquare size={11} />
              {meetingsWithRemarks.length} meeting{meetingsWithRemarks.length !== 1 ? "s" : ""} with your remarks
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar size={14} className="text-[#6800FF]" />
                Upcoming meetings
              </h3>
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md tabular-nums">{upcomingMeetings.length}</span>
            </div>
            {upcomingMeetings.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-xs text-slate-400">No upcoming meetings scheduled</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingMeetings.map((m) => {
                  const d = m.meetingDate ? new Date(m.meetingDate) : null;
                  return (
                    <li key={m.id}>
                      <button onClick={() => openMeeting(m)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left">
                        <div className="flex flex-col items-center justify-center w-11 shrink-0 rounded-lg border border-slate-200 bg-white py-1">
                          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">{d ? d.toLocaleDateString("en-US", { month: "short" }) : "—"}</span>
                          <span className="text-base font-bold text-slate-900 leading-none tabular-nums my-0.5">{d ? d.getDate() : "—"}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold text-slate-900 truncate">{m.companyName}</p>
                          <p className="text-[11px] text-slate-500 truncate">{m.contactName}</p>
                          <p className="text-[10px] text-slate-400 tabular-nums mt-0.5 inline-flex items-center gap-1">
                            <Clock size={9} /> {m.meetingTime || "—"}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User size={14} className="text-[#6800FF]" />
                Your Thyleads team
              </h3>
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md tabular-nums">{teamMembers.length}</span>
            </div>
            {teamMembers.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-xs text-slate-400">No team members assigned yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {teamMembers.map((t) => (
                  <li key={`${t.role}:${t.name}`} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f0e6ff] to-[#e0ccff] text-[#6800FF] flex items-center justify-center text-sm font-bold shrink-0">
                      {t.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-slate-900 truncate">{t.name}</p>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t.role}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 tabular-nums">{t.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare size={14} className="text-[#6800FF]" />
                Recent activity
              </h3>
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md tabular-nums">{recentRemarkItems.length}</span>
            </div>
            {recentRemarkItems.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-xs text-slate-400">No remarks added yet</p>
                <p className="text-[10px] text-slate-400 mt-1">Click any meeting to add a remark</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentRemarkItems.map(({ meeting, remark }) => (
                  <li key={meeting.id}>
                    <button onClick={() => openMeeting(meeting)} className="w-full px-5 py-3 text-left hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[13px] font-bold text-slate-900 truncate">{meeting.companyName}</p>
                        <p className="text-[10px] text-slate-400 shrink-0 ml-2">{fmtRelative(remark.updatedAt)}</p>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{remark.remark}</p>
                      {remark.updatedBy && (
                        <p className="text-[10px] text-slate-400 mt-1.5">by {remark.updatedBy}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
        </div>
      </div>

      {selected && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{selected.companyName}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${(statusStyle[selected.meetingStatus] || statusStyle.pipeline).bg} ${(statusStyle[selected.meetingStatus] || statusStyle.pipeline).text}`}>
                    {(statusStyle[selected.meetingStatus] || statusStyle.pipeline).label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selected.meetingId} · {fmtDate(selected.meetingDate)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Meeting Details</p>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Calendar size={13} className="text-slate-400" />
                    {fmtDate(selected.meetingDate)} at {selected.meetingTime}
                  </div>
                  {selected.geo && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Globe size={13} className="text-slate-400" />
                      {selected.geo}
                    </div>
                  )}
                  {selected.meetingLink && (
                    <a href={selected.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#6800FF] hover:text-[#5800DD]">
                      <Video size={13} /> Join Meeting
                    </a>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Contact</p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <User size={13} className="text-slate-400" />
                    {selected.contactName}
                  </div>
                  {selected.contactTitle && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Building2 size={13} className="text-slate-400" />
                      {selected.contactTitle}
                    </div>
                  )}
                  {selected.contactEmail && (
                    <a href={`mailto:${selected.contactEmail}`} className="flex items-center gap-2 text-sm text-[#6800FF] hover:text-[#5800DD]">
                      <Mail size={13} /> {selected.contactEmail}
                    </a>
                  )}
                  {selected.contactNumber && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={13} className="text-slate-400" />
                      {selected.contactNumber}
                    </div>
                  )}
                </div>
              </div>

              {(selected.salesRep || selected.accountManager) && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Assigned Team</p>
                  <div className="flex items-center gap-6">
                    {selected.salesRep && <div className="text-sm"><span className="text-slate-400">Campaign Owner:</span> <span className="font-medium text-slate-800">{selected.salesRep}</span></div>}
                    {selected.accountManager && <div className="text-sm"><span className="text-slate-400">AM:</span> <span className="font-medium text-slate-800">{selected.accountManager}</span></div>}
                  </div>
                </div>
              )}

              {selected.meetingSummary && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Meeting Summary</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{selected.meetingSummary}</p>
                </div>
              )}

              <div className="bg-[#6800FF]/5 rounded-xl p-4 border border-[#6800FF]/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-[#6800FF] uppercase flex items-center gap-1.5">
                    <MessageSquare size={11} /> Remarks
                  </p>
                  {remarks[selected.meetingId]?.updatedAt && (
                    <p className="text-[10px] text-slate-400">
                      Last updated {fmtRelative(remarks[selected.meetingId].updatedAt)}
                      {remarks[selected.meetingId].updatedBy && ` by ${remarks[selected.meetingId].updatedBy}`}
                    </p>
                  )}
                </div>
                <textarea
                  value={editingRemark}
                  onChange={(e) => setEditingRemark(e.target.value)}
                  placeholder="Add your remarks about this meeting..."
                  rows={4}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed focus:outline-none focus:border-[#6800FF] focus:ring-1 focus:ring-[#6800FF]/20 resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-slate-400">
                    {editingRemark !== (remarks[selected.meetingId]?.remark || "") ? "Unsaved changes" : ""}
                  </p>
                  <button
                    onClick={saveRemark}
                    disabled={savingRemark || editingRemark === (remarks[selected.meetingId]?.remark || "")}
                    className="px-4 py-2 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {savingRemark ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : "Save Remark"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
