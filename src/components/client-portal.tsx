"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { LogOut, Calendar, CheckCircle2, Clock, MessageSquare, X, Mail, Phone, User, Building2, Globe, Video, Loader2, Search, Send, MailOpen, Reply, MousePointer2, AlertTriangle, MailX, ChevronRight, Sparkles } from "lucide-react";
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

function parseMeetingDateTime(date: string, time: string): Date | null {
  if (!date) return null;
  let hh = 0, mm = 0;
  if (time) {
    const cleaned = time.trim();
    const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (ampmMatch) {
      hh = parseInt(ampmMatch[1], 10);
      mm = parseInt(ampmMatch[2], 10);
      const suffix = ampmMatch[3]?.toUpperCase();
      if (suffix === "PM" && hh < 12) hh += 12;
      if (suffix === "AM" && hh === 12) hh = 0;
    }
  }
  const [y, mo, d] = date.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, hh, mm, 0, 0);
}

function fmtCountdown(target: Date, now: number): { label: string; live: boolean; soon: boolean } {
  const diff = target.getTime() - now;
  const abs = Math.abs(diff);
  if (diff < 0 && abs <= 60 * 60_000) return { label: "Live now", live: true, soon: false };
  if (diff < 0) return { label: `Started ${Math.round(abs / 60_000)}m ago`, live: false, soon: false };
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return { label: `In ${mins}m`, live: false, soon: mins <= 30 };
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return { label: `In ${hrs}h`, live: false, soon: false };
  const days = Math.round(hrs / 24);
  if (days === 1) return { label: "Tomorrow", live: false, soon: false };
  if (days < 7) return { label: `In ${days} days`, live: false, soon: false };
  return { label: target.toLocaleDateString("en-US", { month: "short", day: "numeric" }), live: false, soon: false };
}

function meetingBucket(date: string, todayStr: string): "today" | "tomorrow" | "this-week" | "later" | "past" {
  if (!date) return "past";
  if (date === todayStr) return "today";
  const today = new Date(todayStr + "T00:00:00");
  const target = new Date(date + "T00:00:00");
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 1) return "tomorrow";
  if (diffDays > 1 && diffDays <= 7) return "this-week";
  if (diffDays > 7) return "later";
  return "past";
}

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
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.toLocaleDateString("en-US", { month: "long" })} ${now.getFullYear()}`;
  });

  const projectId = user?.projectId || "";
  const meetings: ClientDetail[] = details[projectId] ?? [];

  type SmartleadCampaignRow = {
    campaign_id: number;
    name: string;
    status: string;
    sent_count?: number;
    open_count?: number;
    unique_open_count?: number;
    reply_count?: number;
    click_count?: number;
    unique_click_count?: number;
    bounce_count?: number;
    unsubscribed_count?: number;
  };
  type SmartleadTotals = {
    sent: number; opens: number; replies: number; clicks: number; bounces: number; unsubscribes: number;
    openRate: number; replyRate: number; clickRate: number; bounceRate: number; unsubscribeRate: number;
  };
  const [smartlead, setSmartlead] = useState<{ campaigns: SmartleadCampaignRow[]; totals: SmartleadTotals; configured: boolean; reason?: string } | null>(null);
  const [smartleadLoading, setSmartleadLoading] = useState(true);
  const [smartleadError, setSmartleadError] = useState("");
  const [activeTab, setActiveTab] = useState<"meetings" | "campaigns">("meetings");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!projectId) { setSmartleadLoading(false); return; }
    let cancelled = false;
    (async () => {
      setSmartleadLoading(true);
      setSmartleadError("");
      try {
        const res = await fetch(`/api/portal/smartlead?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) { setSmartleadError(data.error || "Failed to load campaigns"); setSmartleadLoading(false); return; }
        setSmartlead(data);
      } catch (e) {
        if (!cancelled) setSmartleadError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setSmartleadLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

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

  const now = new Date();
  const currentMonth = now.toLocaleDateString("en-US", { month: "long" });
  const currentYear = now.getFullYear();
  const currentMonthLabel = `${currentMonth} ${currentYear}`;
  const months = [...new Set([currentMonthLabel, ...meetings.map((m) => `${m.month} ${m.year}`)])];
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

  const scheduledCount = meetings.filter((m) => m.meetingStatus === "scheduled").length;
  const pipelineCount = meetings.filter((m) => m.meetingStatus === "pipeline").length;
  const doneCount = meetings.filter((m) => m.meetingStatus === "done").length;

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const upcomingMeetings = meetings
    .filter((m) => m.meetingStatus === "scheduled" && m.meetingDate && m.meetingDate >= todayStr)
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate) || (a.meetingTime || "").localeCompare(b.meetingTime || ""));

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

        <div className="bg-white border border-slate-200 rounded-2xl p-1 mb-5 inline-flex shadow-sm">
          {([
            { key: "meetings" as const, label: "Meetings", count: meetings.length },
            { key: "campaigns" as const, label: "Campaigns", count: smartlead?.campaigns.length || 0 },
          ]).map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
                  active ? "bg-[#6800FF] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
                <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {activeTab === "campaigns" && (
          <CampaignsSection smartlead={smartlead} loading={smartleadLoading} error={smartleadError} />
        )}

        {activeTab === "meetings" && (() => {
          const heroMeeting = upcomingMeetings[0];
          const heroDt = heroMeeting ? parseMeetingDateTime(heroMeeting.meetingDate, heroMeeting.meetingTime) : null;
          const heroCountdown = heroDt ? fmtCountdown(heroDt, nowMs) : null;
          const awaitingFeedbackCount = meetings.filter((m) => m.meetingStatus === "done" && !remarks[m.meetingId]?.remark).length;
          const thisWeekScheduled = upcomingMeetings.filter((m) => {
            if (!m.meetingDate) return false;
            const today = new Date(todayStr + "T00:00:00");
            const target = new Date(m.meetingDate + "T00:00:00");
            return target.getTime() - today.getTime() <= 7 * 86_400_000;
          }).length;

          const filterChips: Array<{ key: string; label: string; count: number }> = [
            { key: "all",       label: "All",       count: meetings.length },
            { key: "scheduled", label: "Upcoming",  count: scheduledCount },
            { key: "done",      label: "Completed", count: doneCount },
            { key: "pipeline",  label: "Pipeline",  count: pipelineCount },
          ];

          const buckets = filtered.reduce<Record<string, ClientDetail[]>>((acc, m) => {
            const b = meetingBucket(m.meetingDate, todayStr);
            if (b === "today") (acc.today ||= []).push(m);
            else if (b === "tomorrow") (acc.tomorrow ||= []).push(m);
            else if (b === "this-week") (acc["this-week"] ||= []).push(m);
            else {
              const key = parseMonthKey(m);
              (acc[key] ||= []).push(m);
            }
            return acc;
          }, {});
          const monthKeysSorted = Object.keys(buckets).filter((k) => !["today", "tomorrow", "this-week"].includes(k)).sort((a, b) => monthSortKey(b) - monthSortKey(a));
          const orderedBuckets: Array<[string, ClientDetail[], string]> = [];
          if (buckets.today) orderedBuckets.push(["today", buckets.today, "Today"]);
          if (buckets.tomorrow) orderedBuckets.push(["tomorrow", buckets.tomorrow, "Tomorrow"]);
          if (buckets["this-week"]) orderedBuckets.push(["this-week", buckets["this-week"], "This week"]);
          for (const k of monthKeysSorted) orderedBuckets.push([k, buckets[k], k]);

          return (
        <div className="space-y-5">
          {heroMeeting && heroCountdown ? (
            <button
              onClick={() => openMeeting(heroMeeting)}
              className={`w-full text-left rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                heroCountdown.live
                  ? "border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50"
                  : heroCountdown.soon
                    ? "border-[#6800FF]/30 bg-gradient-to-br from-[#f7f0ff] via-white to-[#f7f0ff]"
                    : "border-slate-200 bg-white"
              }`}
            >
              <div className="px-6 py-5 flex flex-col md:flex-row md:items-center gap-5">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`shrink-0 w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-white shadow-md ${heroCountdown.live ? "bg-emerald-600" : heroCountdown.soon ? "bg-[#6800FF]" : "bg-slate-900"}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{heroDt!.toLocaleDateString("en-US", { month: "short" })}</span>
                    <span className="text-2xl font-bold leading-none tabular-nums">{heroDt!.getDate()}</span>
                    <span className="text-[9px] font-medium opacity-70 mt-0.5">{heroDt!.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        heroCountdown.live ? "bg-emerald-100 text-emerald-700" : heroCountdown.soon ? "bg-[#6800FF]/10 text-[#6800FF]" : "bg-slate-100 text-slate-600"
                      }`}>
                        {heroCountdown.live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                        {heroCountdown.label === "Live now" ? "Live now" : "Next meeting"}
                      </span>
                      {heroCountdown.label !== "Live now" && (
                        <span className="text-[11px] font-semibold text-slate-500">{heroCountdown.label}</span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 truncate mt-1.5">{heroMeeting.companyName}</h2>
                    <p className="text-sm text-slate-600 truncate mt-0.5">
                      {heroMeeting.contactName}{heroMeeting.contactTitle ? <span className="text-slate-400"> · {heroMeeting.contactTitle}</span> : null}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5 tabular-nums"><Clock size={12} className="text-slate-400" /> {heroMeeting.meetingTime || "—"}</span>
                      {heroMeeting.salesRep && <span className="inline-flex items-center gap-1.5"><User size={12} className="text-slate-400" /> {heroMeeting.salesRep}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {heroMeeting.meetingLink && (
                    <a
                      href={heroMeeting.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        heroCountdown.live ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-[#6800FF] hover:bg-[#5800DD] text-white"
                      }`}
                    >
                      <Video size={14} /> Join meeting
                    </a>
                  )}
                  <span className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
                    Details <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            </button>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Calendar size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">No upcoming meetings scheduled</p>
                <p className="text-xs text-slate-500 mt-0.5">Your past meetings are below. New ones will appear here as Thyleads books them.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <PulseCard label="This week" value={thisWeekScheduled} sub="upcoming meetings" icon={Calendar} accent="text-[#6800FF]" bg="bg-[#f0e6ff]" />
            <PulseCard label="Awaiting your feedback" value={awaitingFeedbackCount} sub="completed, no remark" icon={MessageSquare} accent="text-amber-700" bg="bg-amber-50" />
            <PulseCard label="Completed" value={doneCount} sub="all time" icon={CheckCircle2} accent="text-emerald-700" bg="bg-emerald-50" />
            <PulseCard label="In pipeline" value={pipelineCount} sub="being qualified" icon={Sparkles} accent="text-sky-700" bg="bg-sky-50" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  {filterChips.map((chip) => {
                    const active = (chip.key === "all" && statusFilter === "all") || statusFilter === chip.key;
                    return (
                      <button
                        key={chip.key}
                        onClick={() => setStatusFilter(chip.key)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          active
                            ? "bg-[#6800FF] text-white border-[#6800FF]"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {chip.label}
                        <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{chip.count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                      type="text"
                      placeholder="Search…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
                    />
                  </div>
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
                  >
                    <option value="all">All months</option>
                    {months.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={20} className="text-[#6800FF] animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                    <Calendar size={18} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">No meetings match</p>
                  <p className="text-xs text-slate-400 mt-1">{search || statusFilter !== "all" || monthFilter !== "all" ? "Try clearing your filters" : "Your meetings will appear here"}</p>
                </div>
              ) : (
                <div className="max-h-[640px] overflow-y-auto">
                  {orderedBuckets.map(([bucketKey, group, label]) => {
                    const isPriorityBucket = bucketKey === "today" || bucketKey === "tomorrow" || bucketKey === "this-week";
                    return (
                      <div key={bucketKey}>
                        <div className="px-5 py-2 bg-slate-50/80 backdrop-blur-sm border-y border-slate-100 flex items-center justify-between sticky top-0 z-10">
                          <p className={`text-[11px] font-bold uppercase tracking-wider ${isPriorityBucket ? "text-[#6800FF]" : "text-slate-600"}`}>{label}</p>
                          <p className="text-[11px] font-semibold text-slate-400 tabular-nums">{group.length}</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {group.map((m) => {
                            const dotColor = m.meetingStatus === "done" ? "bg-emerald-500" : m.meetingStatus === "scheduled" ? "bg-blue-500" : "bg-amber-500";
                            const rm = remarks[m.meetingId];
                            const hasRemark = !!rm?.remark;
                            const dateObj = m.meetingDate ? new Date(m.meetingDate) : null;
                            const dayNum = dateObj ? dateObj.getDate() : "—";
                            const weekday = dateObj ? dateObj.toLocaleDateString("en-US", { weekday: "short" }) : "";
                            const dt = parseMeetingDateTime(m.meetingDate, m.meetingTime);
                            const isUpcomingScheduled = m.meetingStatus === "scheduled" && dt && dt.getTime() > nowMs;
                            return (
                              <button
                                key={m.id}
                                onClick={() => openMeeting(m)}
                                className="w-full px-5 py-3 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors group"
                              >
                                <div className={`shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center transition-colors ${
                                  isPriorityBucket ? "bg-[#6800FF] text-white" : "border border-slate-200 bg-white text-slate-900 group-hover:border-[#6800FF]/40"
                                }`}>
                                  <span className="text-base font-bold leading-none tabular-nums">{dayNum}</span>
                                  <span className={`text-[9px] font-medium mt-0.5 uppercase ${isPriorityBucket ? "opacity-70" : "text-slate-400"}`}>{weekday}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                                    <p className="text-sm font-bold text-slate-900 truncate">{m.companyName}</p>
                                    {hasRemark && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-[#6800FF]" title="You added a remark">
                                        <MessageSquare size={9} />
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                                    {m.contactName}{m.contactTitle ? <span className="text-slate-400"> · {m.contactTitle}</span> : null}
                                  </p>
                                </div>
                                <div className="shrink-0 flex items-center gap-3">
                                  <span className="text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">{m.meetingTime || "—"}</span>
                                  {isUpcomingScheduled && m.meetingLink ? (
                                    <a
                                      href={m.meetingLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#6800FF]/5 text-[#6800FF] hover:bg-[#6800FF]/10 transition-colors"
                                    >
                                      <Video size={11} /> Join
                                    </a>
                                  ) : (
                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-[#6800FF] transition-colors" />
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
            </div>

            <aside className="space-y-5">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MessageSquare size={14} className="text-[#6800FF]" />
                    Recent feedback
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md tabular-nums">{recentRemarkItems.length}</span>
                </div>
                {recentRemarkItems.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-xs text-slate-500 font-medium">No remarks yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">Click any meeting to share feedback with your Thyleads team.</p>
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
                          <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed">{remark.remark}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {teamMembers.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Working with you</p>
                  </div>
                  <ul className="px-5 py-3 flex flex-wrap gap-2">
                    {teamMembers.map((t) => (
                      <li key={`${t.role}:${t.name}`} className="inline-flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg" title={t.role}>
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#f0e6ff] to-[#e0ccff] text-[#6800FF] flex items-center justify-center text-[10px] font-bold">
                          {t.name[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-700">{t.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </div>
        );})()}
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

type CampaignsSectionProps = {
  smartlead: {
    campaigns: Array<{
      campaign_id: number;
      name: string;
      status: string;
      sent_count?: number;
      open_count?: number;
      unique_open_count?: number;
      reply_count?: number;
      click_count?: number;
      unique_click_count?: number;
      bounce_count?: number;
      unsubscribed_count?: number;
    }>;
    totals: {
      sent: number; opens: number; replies: number; clicks: number; bounces: number; unsubscribes: number;
      openRate: number; replyRate: number; clickRate: number; bounceRate: number; unsubscribeRate: number;
    };
    configured: boolean;
    reason?: string;
  } | null;
  loading: boolean;
  error: string;
};

function CampaignsSection({ smartlead, loading, error }: CampaignsSectionProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-5 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={14} className="animate-spin" /> Loading campaign metrics…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-sm text-amber-800">
        Couldn&apos;t load Smartlead campaigns: {error}
      </div>
    );
  }
  if (!smartlead || !smartlead.configured) {
    const reason = smartlead?.reason;
    if (reason === "no-name-match") {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-5">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">Outbound campaigns</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">No Smartlead campaigns matched this account&apos;s name yet.</p>
          </div>
          <div className="p-6 text-sm text-slate-600 leading-relaxed">
            <p>Your Thyleads admin can attach specific Smartlead campaigns to this account from the dashboard if name-based matching isn&apos;t catching them.</p>
          </div>
        </div>
      );
    }
    const isKeyMissing = reason === "no-key";
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Outbound campaigns</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Live Smartlead performance — Sent, Opens, Replies, Clicks, Bounces, Unsubscribes</p>
        </div>
        <div className="p-6 text-sm leading-relaxed space-y-2 text-slate-600">
          {isKeyMissing ? (
            <p>Smartlead isn&apos;t connected on the server yet. Thyleads needs to set <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px] font-mono">SMARTLEAD_API_KEY</code> and restart.</p>
          ) : (
            <p>No campaigns are showing up for this account yet. Reach out to your Thyleads team if you expected to see live metrics here.</p>
          )}
        </div>
      </div>
    );
  }
  if (smartlead.campaigns.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Outbound campaigns</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">No campaigns returned from Smartlead — check the configured IDs.</p>
        </div>
      </div>
    );
  }

  const { campaigns, totals } = smartlead;
  const summary: Array<{ label: string; value: string; sub: string; icon: typeof Send; accent: string; bg: string }> = [
    { label: "Sent",         value: totals.sent.toLocaleString(),         sub: `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`, icon: Send,          accent: "text-slate-700",   bg: "bg-slate-50" },
    { label: "Open rate",    value: `${totals.openRate}%`,                sub: `${totals.opens.toLocaleString()} opens`,                            icon: MailOpen,      accent: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Reply rate",   value: `${totals.replyRate}%`,               sub: `${totals.replies.toLocaleString()} replies`,                        icon: Reply,         accent: "text-[#6800FF]",   bg: "bg-[#f0e6ff]" },
    { label: "Click rate",   value: `${totals.clickRate}%`,               sub: `${totals.clicks.toLocaleString()} clicks`,                          icon: MousePointer2, accent: "text-sky-700",     bg: "bg-sky-50" },
    { label: "Bounce rate",  value: `${totals.bounceRate}%`,              sub: `${totals.bounces.toLocaleString()} bounces`,                        icon: AlertTriangle, accent: "text-amber-700",   bg: "bg-amber-50" },
    { label: "Unsub rate",   value: `${totals.unsubscribeRate}%`,         sub: `${totals.unsubscribes.toLocaleString()} unsubs`,                    icon: MailX,         accent: "text-rose-700",    bg: "bg-rose-50" },
  ];

  return (
    <div className="space-y-5 mb-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summary.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
                <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${c.bg} ${c.accent}`}>
                  <Icon size={13} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{c.value}</p>
              <p className="text-[10px] text-slate-500 mt-1">{c.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-slate-900">Campaigns</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">All campaigns running for your account</p>
          </div>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md tabular-nums">{campaigns.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-6 py-3">Campaign</th>
                <th className="text-left px-3 py-3">Status</th>
                <th className="text-right px-3 py-3">Sent</th>
                <th className="text-right px-3 py-3">Open</th>
                <th className="text-right px-3 py-3">Reply</th>
                <th className="text-right px-3 py-3">Click</th>
                <th className="text-right px-3 py-3">Bounce</th>
                <th className="text-right px-6 py-3">Unsub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c) => {
                const toNum = (v: unknown) => {
                  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
                  if (typeof v === "string") { const p = Number(v); return Number.isFinite(p) ? p : 0; }
                  return 0;
                };
                const sent = toNum(c.sent_count);
                const opens = toNum(c.unique_open_count ?? c.open_count);
                const replies = toNum(c.reply_count);
                const clicks = toNum(c.unique_click_count ?? c.click_count);
                const bounces = toNum(c.bounce_count);
                const unsubs = toNum(c.unsubscribed_count);
                const status = (c.status || "").toLowerCase();
                const statusColor =
                  status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  status === "paused" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  status === "completed" ? "bg-slate-100 text-slate-600 border-slate-200" :
                  status === "drafted" ? "bg-slate-50 text-slate-500 border-slate-200" :
                  "bg-slate-50 text-slate-500 border-slate-200";
                const dotColor =
                  status === "active" ? "bg-emerald-500" :
                  status === "paused" ? "bg-amber-500" :
                  status === "completed" ? "bg-slate-500" :
                  "bg-slate-300";
                return (
                  <tr key={c.campaign_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate max-w-[280px]" title={c.name}>{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">#{c.campaign_id}</p>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                        {c.status || "unknown"}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <p className="text-sm font-semibold text-slate-900 tabular-nums">{sent.toLocaleString()}</p>
                    </td>
                    <RateCell num={opens} den={sent} color="emerald" />
                    <RateCell num={replies} den={sent} color="violet" />
                    <RateCell num={clicks} den={sent} color="sky" />
                    <RateCell num={bounces} den={sent} color="amber" />
                    <RateCell num={unsubs} den={sent} color="rose" lastCol />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PulseCard({ label, value, sub, icon: Icon, accent, bg }: { label: string; value: number; sub: string; icon: typeof Send; accent: string; bg: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${bg} ${accent}`}>
          <Icon size={13} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{value}</p>
      <p className="text-[10px] text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function RateCell({ num, den, color, lastCol }: { num: number; den: number; color: "emerald" | "violet" | "sky" | "amber" | "rose"; lastCol?: boolean }) {
  const pct = den > 0 ? (num / den) * 100 : 0;
  const pctLabel = den > 0 ? `${Math.round(pct * 10) / 10}%` : "—";
  const barColor = {
    emerald: "bg-emerald-500",
    violet: "bg-[#6800FF]",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }[color];
  return (
    <td className={`py-4 text-right tabular-nums ${lastCol ? "px-6" : "px-3"}`}>
      <p className="text-sm font-semibold text-slate-900">{num.toLocaleString()}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{pctLabel}</p>
      <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden w-20 ml-auto">
        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </td>
  );
}
