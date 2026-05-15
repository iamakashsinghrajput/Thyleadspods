"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, Loader2, Mail, MailOpen, Send, MailX, Clock, CalendarClock, RefreshCw, ExternalLink, ChevronDown, ChevronRight, Megaphone, Check, Inbox } from "lucide-react";

type CampaignRow = {
  campaign_id: number;
  name: string;
  status: string;
  created_at?: string;
  sent_count?: number | string;
  total_count?: number | string;
  reply_count?: number | string;
  unique_reply_count?: number | string;
  positive_reply_count?: number | string;
  bounce_count?: number | string;
  unsubscribed_count?: number | string;
};

type SequenceStep = {
  id?: number;
  seq_number?: number;
  seq_delay_details?: { delay_in_days?: number } | null;
  subject?: string;
  email_body?: string;
  sequence_variants?: Array<{ variant_label?: string; subject?: string; email_body?: string }>;
};

type EmailAccount = {
  id?: number;
  from_name?: string;
  from_email?: string;
  daily_sent_count?: number;
  message_per_day?: number;
};

type CampaignDetailResp = {
  campaign: { id: number; name: string; status: string; created_at?: string };
  analytics: CampaignRow | null;
  sequences: SequenceStep[];
  accounts: EmailAccount[];
  schedule: {
    timezone?: string;
    days_of_the_week?: number[];
    start_hour?: string;
    end_hour?: string;
    min_time_btw_emails?: number;
    max_new_leads_per_day?: number;
  } | null;
};

type InboxThreadRow = {
  threadKey: string;
  leadId: number;
  campaignId: number;
  campaignName: string;
  leadFirstName: string;
  leadLastName: string;
  leadEmail: string;
  leadCompany: string;
  leadTitle: string;
  category: string;
  replyCount: number;
  lastReplyAt: string | null;
  lastReplyPreview: string;
  lastReplySubject: string;
  locallyReadAt: string | null;
};

type InboxMessageRow = {
  type: string;
  subject?: string;
  body?: string;
  fromEmail?: string;
  toEmail?: string;
  time?: string | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") { const p = Number(v); return Number.isFinite(p) ? p : 0; }
  return 0;
}

function statusGroup(s: string): "active" | "paused" | "completed" | "other" {
  const v = (s || "").toLowerCase();
  if (v === "active") return "active";
  if (v === "paused") return "paused";
  if (v === "completed") return "completed";
  return "other";
}

function isReplyType(t: string | undefined): boolean {
  if (!t) return false;
  const u = t.toString().toUpperCase();
  return u === "REPLY" || u === "RECEIVED" || u === "INBOUND" || u.includes("REPLY");
}

function fmtThreadTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function categoryStyle(cat: string): { bg: string; text: string; border: string } {
  const c = (cat || "").toLowerCase();
  if (c === "interested" || c.includes("interest"))    return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
  if (c.includes("meeting"))                            return { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200" };
  if (c.includes("not interested") || c.includes("dnc")) return { bg: "bg-rose-50",   text: "text-rose-700",    border: "border-rose-200" };
  if (c.includes("out of office") || c.includes("ooo")) return { bg: "bg-slate-100",  text: "text-slate-600",   border: "border-slate-200" };
  if (c.includes("wrong"))                              return { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" };
  if (c.includes("info"))                               return { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200" };
  return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };
}

function statusDotCls(s: string): string {
  const v = (s || "").toLowerCase();
  if (v === "active") return "bg-emerald-500";
  if (v === "paused") return "bg-amber-500";
  if (v === "completed") return "bg-slate-500";
  return "bg-slate-300";
}

export default function CampaignDetails({ projectId, actorEmail, filterSlot }: { projectId: string; actorEmail: string; filterSlot?: HTMLElement | null }) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState("");
  const [configured, setConfigured] = useState(false);
  const [reason, setReason] = useState<string | undefined>();

  const [campaignFilter, setCampaignFilter] = useState<"all" | number>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "completed">("all");
  const [search, setSearch] = useState("");

  const [threads, setThreads] = useState<InboxThreadRow[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState("");
  const [threadsTotal, setThreadsTotal] = useState(0);
  const [threadsUnread, setThreadsUnread] = useState(0);
  const [threadsCampaignFacet, setThreadsCampaignFacet] = useState<{ id: number; name: string; count: number }[]>([]);

  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<InboxMessageRow[]>([]);
  const [threadMessagesLoading, setThreadMessagesLoading] = useState(false);

  const [campaignDetail, setCampaignDetail] = useState<CampaignDetailResp | null>(null);
  const [campaignDetailLoading, setCampaignDetailLoading] = useState(false);

  const [campaignsSectionOpen, setCampaignsSectionOpen] = useState(true);
  const [categoriesSectionOpen, setCategoriesSectionOpen] = useState(true);

  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      setCampaignsLoading(true);
      setCampaignsError("");
      try {
        const res = await fetch(`/api/portal/smartlead?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok && res.status !== 503) setCampaignsError(data.error || "Failed to load campaigns");
        setCampaigns(data.campaigns || []);
        setConfigured(!!data.configured);
        setReason(data.reason);
      } catch (e) {
        if (!cancelled) setCampaignsError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setCampaignsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, refreshTick]);

  const loadThreads = useCallback(async () => {
    if (!projectId) return;
    setThreadsLoading(true);
    setThreadsError("");
    try {
      const qs = new URLSearchParams({ projectId });
      if (campaignFilter !== "all") qs.set("campaign", String(campaignFilter));
      if (search.trim()) qs.set("q", search.trim());
      if (unreadOnly) qs.set("unread", "1");
      qs.set("limit", "150");
      const res = await fetch(`/api/portal/inbox?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setThreadsError(json.error || "Failed to load replies"); return; }
      setThreads(json.threads || []);
      setThreadsTotal(json.total || 0);
      setThreadsUnread(json.unreadCount || 0);
      setThreadsCampaignFacet(json.campaigns || []);
    } catch (e) {
      setThreadsError(e instanceof Error ? e.message : "Network error");
    } finally {
      setThreadsLoading(false);
    }
  }, [projectId, campaignFilter, search, unreadOnly]);

  useEffect(() => { void loadThreads(); }, [loadThreads, refreshTick]);

  const loadThreadMessages = useCallback(async (key: string) => {
    setSelectedThreadKey(key);
    setThreadMessagesLoading(true);
    try {
      const [leadIdStr, campaignIdStr] = key.split(":");
      const res = await fetch(`/api/portal/inbox/thread/${leadIdStr}/${campaignIdStr}?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) return;
      setThreadMessages(json.messages || []);
      const target = threads.find((t) => t.threadKey === key);
      if (target && !target.locallyReadAt) {
        void fetch(`/api/portal/inbox/thread/${leadIdStr}/${campaignIdStr}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, action: "mark-read" }),
        }).then(() => {
          const stamp = new Date().toISOString();
          setThreads((prev) => prev.map((t) => t.threadKey === key ? { ...t, locallyReadAt: stamp } : t));
          setThreadsUnread((u) => Math.max(0, u - 1));
        }).catch(() => {});
      }
    } finally {
      setThreadMessagesLoading(false);
    }
  }, [projectId, threads]);

  useEffect(() => {
    if (campaignFilter === "all" || selectedThreadKey) { setCampaignDetail(null); return; }
    let cancelled = false;
    (async () => {
      setCampaignDetailLoading(true);
      setCampaignDetail(null);
      try {
        const res = await fetch(`/api/smartlead/campaign/${campaignFilter}?actor=${encodeURIComponent(actorEmail)}`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && res.ok) setCampaignDetail(json);
      } catch {}
      finally { if (!cancelled) setCampaignDetailLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [campaignFilter, actorEmail, selectedThreadKey]);

  const counts = useMemo(() => {
    const c = { total: campaigns.length, active: 0, paused: 0, completed: 0 };
    for (const x of campaigns) {
      const g = statusGroup(x.status);
      if (g === "active") c.active++;
      else if (g === "paused") c.paused++;
      else if (g === "completed") c.completed++;
    }
    return c;
  }, [campaigns]);

  const aggregatedTotals = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => {
        acc.leads += toNum(c.total_count);
        acc.sent += toNum(c.sent_count);
        acc.positiveReply += toNum(c.positive_reply_count);
        acc.uniqueReply += toNum(c.unique_reply_count);
        acc.replied += toNum(c.reply_count);
        acc.bounced += toNum(c.bounce_count);
        return acc;
      },
      { leads: 0, sent: 0, positiveReply: 0, uniqueReply: 0, replied: 0, bounced: 0 },
    );
  }, [campaigns]);

  const filteredCampaignsForSidebar = useMemo(() => {
    return campaigns.filter((c) => {
      if (statusFilter === "all") return true;
      return statusGroup(c.status) === statusFilter;
    });
  }, [campaigns, statusFilter]);

  const threadCountByCampaignId = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of threadsCampaignFacet) m.set(c.id, c.count);
    return m;
  }, [threadsCampaignFacet]);

  const categoryFacet = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of threads) {
      const k = t.category?.trim();
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  }, [threads]);

  const visibleThreads = useMemo(() => {
    if (categoryFilters.size === 0) return threads;
    return threads.filter((t) => categoryFilters.has(t.category || ""));
  }, [threads, categoryFilters]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.threadKey === selectedThreadKey) || null,
    [threads, selectedThreadKey],
  );

  const selectedCampaign = useMemo(
    () => campaignFilter === "all" ? null : campaigns.find((c) => c.campaign_id === campaignFilter) || null,
    [campaigns, campaignFilter],
  );

  if (campaignsLoading) {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-center py-20 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin mr-2" /> Loading campaigns…
        </div>
      </section>
    );
  }
  if (campaignsError) {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-6 text-sm text-amber-700 bg-amber-50">{campaignsError}</div>
      </section>
    );
  }
  if (!configured) {
    return (
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-8 text-sm text-slate-500 leading-relaxed">
          {reason === "no-key" ? (
            <span>Set <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px] font-mono">SMARTLEAD_API_KEY</code> in <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px] font-mono">.env.local</code> and restart the server.</span>
          ) : reason === "no-name-match" ? (
            <span>No Smartlead campaigns match this client name. Attach specific campaign IDs from the &ldquo;Smartlead campaigns&rdquo; card above.</span>
          ) : (
            <span>No campaigns linked to this client yet.</span>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#f0e6ff] text-[#6800FF] flex items-center justify-center">
            <Megaphone size={15} />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-slate-900">Campaign Details</h2>
            <p className="text-[11px] text-slate-500">
              {counts.total} {counts.total === 1 ? "campaign" : "campaigns"} · {threadsTotal.toLocaleString()} threads · {threadsUnread.toLocaleString()} unread
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={threadsLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
          >
            <RefreshCw size={12} className={threadsLoading ? "animate-spin text-[#6800FF]" : ""} /> Sync
          </button>
        </div>
      </header>

      {(() => {
        const filtersNode = (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-2">Status</p>
              <div className="space-y-0.5">
                <SidebarItem label="All threads" count={threadsTotal} active={!unreadOnly} onClick={() => setUnreadOnly(false)} />
                <SidebarItem label="Unread" count={threadsUnread} active={unreadOnly} onClick={() => setUnreadOnly(true)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 px-2">
                <button
                  onClick={() => setCategoriesSectionOpen((v) => !v)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                >
                  {categoriesSectionOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  Categories
                  {categoryFilters.size > 0 && (
                    <span className="ml-1 px-1.5 py-px rounded-full bg-[#6800FF] text-white text-[9px] tabular-nums">{categoryFilters.size}</span>
                  )}
                </button>
                {categoryFilters.size > 0 && (
                  <button onClick={() => setCategoryFilters(new Set())} className="text-[10px] font-semibold text-slate-400 hover:text-red-600">Clear</button>
                )}
              </div>
              {categoriesSectionOpen && (
                <div className="space-y-0.5">
                  {categoryFacet.length === 0 && <p className="text-[11px] text-slate-400 px-2 py-1">No categories yet</p>}
                  {categoryFacet.map((c) => {
                    const checked = categoryFilters.has(c.key);
                    return (
                      <button
                        key={c.key}
                        onClick={() => {
                          setCategoryFilters((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.key)) next.delete(c.key); else next.add(c.key);
                            return next;
                          });
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors ${
                          checked ? "bg-[#f0e6ff] text-[#6800FF] font-semibold" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center ${
                            checked ? "bg-[#6800FF] border-[#6800FF] text-white" : "border-slate-300 bg-white"
                          }`}>
                            {checked && <Check size={10} />}
                          </span>
                          <span className="truncate">{c.key}</span>
                        </span>
                        <span className={`text-[10px] tabular-nums shrink-0 ${checked ? "text-[#6800FF]" : "text-slate-400"}`}>{c.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 px-2">
                <button
                  onClick={() => setCampaignsSectionOpen((v) => !v)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                >
                  {campaignsSectionOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  Campaigns
                  {campaignFilter !== "all" && (
                    <span className="ml-1 px-1.5 py-px rounded-full bg-[#6800FF] text-white text-[9px]">1</span>
                  )}
                </button>
                {campaignFilter !== "all" && (
                  <button onClick={() => setCampaignFilter("all")} className="text-[10px] font-semibold text-slate-400 hover:text-red-600">Clear</button>
                )}
              </div>
              {campaignsSectionOpen && (
                <>
                  <div className="mx-2 mb-2 grid grid-cols-2 gap-0.5 bg-slate-100 rounded-md p-0.5">
                    {(["all", "active", "paused", "completed"] as const).map((s) => {
                      const active = statusFilter === s;
                      const lbl = s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1);
                      const count = s === "all" ? counts.total : counts[s];
                      return (
                        <button
                          key={s}
                          onClick={() => setStatusFilter(s)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center justify-between gap-1.5 transition-all ${
                            active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          <span>{lbl}</span>
                          <span className={`tabular-nums text-[10px] ${active ? "text-slate-500" : "text-slate-400"}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-0.5">
                    <SidebarItem label="All campaigns" count={threadsTotal} active={campaignFilter === "all"} onClick={() => setCampaignFilter("all")} />
                    {filteredCampaignsForSidebar.map((c) => {
                      const active = campaignFilter === c.campaign_id;
                      const replyCount = threadCountByCampaignId.get(c.campaign_id) || 0;
                      return (
                        <button
                          key={c.campaign_id}
                          onClick={() => setCampaignFilter(c.campaign_id)}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors ${
                            active ? "bg-[#6800FF] text-white font-semibold" : "text-slate-700 hover:bg-slate-50"
                          }`}
                          title={c.name}
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-white/70" : statusDotCls(c.status)}`} />
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className={`text-[10px] tabular-nums shrink-0 ${active ? "text-white/80" : "text-slate-400"}`}>{replyCount}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        );

        return filterSlot ? createPortal(filtersNode, filterSlot) : null;
      })()}

      <div className="flex min-h-[680px] max-h-[80vh]">
        {!filterSlot && (
          <aside className="w-56 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
            <div className="p-3 space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-2">Status</p>
                <div className="space-y-0.5">
                  <SidebarItem label="All threads" count={threadsTotal} active={!unreadOnly} onClick={() => setUnreadOnly(false)} />
                  <SidebarItem label="Unread" count={threadsUnread} active={unreadOnly} onClick={() => setUnreadOnly(true)} />
                </div>
              </div>
              <div className="text-[10.5px] text-slate-400 px-2">Open Campaign Details to access category and campaign filters.</div>
            </div>
          </aside>
        )}

        <section className="w-[400px] shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="px-3 pt-3 pb-2 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[14px] font-bold text-slate-900">
                {selectedCampaign ? selectedCampaign.name : "Inbox"}
              </h3>
              <span className="text-[10px] text-slate-400 tabular-nums">{visibleThreads.length} of {threadsTotal}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lead, subject, company…"
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
              />
            </div>
            {selectedCampaign && (
              <CampaignKpiStrip campaign={selectedCampaign} />
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {threadsLoading && visibleThreads.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin mr-2" /> Loading…
              </div>
            ) : threadsError ? (
              <div className="p-4 m-3 text-xs text-amber-800 bg-amber-50 rounded-lg">{threadsError}</div>
            ) : visibleThreads.length === 0 ? (
              <div className="text-center py-14 px-4 text-sm text-slate-400">
                <Inbox size={22} className="text-slate-300 mx-auto mb-2" />
                {search || unreadOnly || categoryFilters.size > 0
                  ? "No threads match these filters."
                  : campaignFilter !== "all" ? "No replies for this campaign yet." : "No replies received yet."}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleThreads.map((t) => {
                  const unread = !t.locallyReadAt;
                  const name = `${t.leadFirstName || ""} ${t.leadLastName || ""}`.trim() || t.leadEmail || "Unknown";
                  const active = selectedThreadKey === t.threadKey;
                  const cat = categoryStyle(t.category);
                  const AvatarIcon = unread ? Mail : MailOpen;
                  return (
                    <li key={t.threadKey}>
                      <button
                        onClick={() => loadThreadMessages(t.threadKey)}
                        className={`w-full text-left px-4 py-3 flex gap-3 transition-colors border-l-2 ${
                          active
                            ? "bg-[#f0e6ff] border-l-[#6800FF]"
                            : "border-l-transparent hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                            active
                              ? "bg-[#6800FF] border-[#6800FF] text-white"
                              : unread ? "bg-violet-50 border-violet-200 text-[#6800FF]" : "bg-white border-slate-200 text-slate-400"
                          }`}
                          aria-hidden
                        >
                          <AvatarIcon size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <p className={`text-[13.5px] truncate ${unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>{name}</p>
                            <span className="text-[11px] text-slate-400 shrink-0 ml-auto tabular-nums whitespace-nowrap" title={t.lastReplyAt ? new Date(t.lastReplyAt).toLocaleString() : ""}>{fmtThreadTime(t.lastReplyAt)}</span>
                          </div>
                          {t.leadEmail && (
                            <p className="text-[11.5px] text-slate-500 truncate mt-0.5">{t.leadEmail}</p>
                          )}
                          <p className={`text-[12px] mt-1.5 truncate ${unread ? "font-medium text-slate-700" : "text-slate-600"}`}>{t.lastReplySubject || "Got reply from the lead"}</p>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {t.category && (
                              <span className={`inline-flex items-center text-[10.5px] font-semibold rounded-md px-1.5 py-0.5 border ${cat.bg} ${cat.text} ${cat.border}`}>
                                {t.category}
                              </span>
                            )}
                            {campaignFilter === "all" && t.campaignName && (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 truncate max-w-[180px]" title={t.campaignName}>
                                <Megaphone size={9} className="text-slate-400 shrink-0" />
                                <span className="truncate">{t.campaignName}</span>
                              </span>
                            )}
                            {t.replyCount > 1 && (
                              <span className="inline-flex items-center text-[10.5px] font-semibold rounded-md px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {t.replyCount} replies
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="flex-1 bg-slate-50/40 min-w-0 flex flex-col">
          {selectedThread ? (
            <ThreadView
              thread={selectedThread}
              messages={threadMessages}
              loading={threadMessagesLoading}
              onBack={() => { setSelectedThreadKey(null); setThreadMessages([]); }}
            />
          ) : selectedCampaign ? (
            <CampaignOverview
              campaign={selectedCampaign}
              detail={campaignDetail}
              detailLoading={campaignDetailLoading}
            />
          ) : (
            <DefaultOverview totals={aggregatedTotals} campaignCount={counts.total} />
          )}
        </section>
      </div>
    </section>
  );
}

function SidebarItem({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors ${
        active ? "bg-[#f0e6ff] text-[#6800FF] font-semibold" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={`text-[10px] tabular-nums shrink-0 ${active ? "text-[#6800FF]" : "text-slate-400"}`}>{count}</span>
    </button>
  );
}

function CampaignKpiStrip({ campaign }: { campaign: CampaignRow }) {
  const leads = toNum(campaign.total_count);
  const sent = toNum(campaign.sent_count);
  const positive = toNum(campaign.positive_reply_count);
  const unique = toNum(campaign.unique_reply_count);
  const replied = toNum(campaign.reply_count);
  const bounced = toNum(campaign.bounce_count);
  return (
    <div className="mt-3 grid grid-cols-3 gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5">
      <KpiMini label="Leads"   value={leads} />
      <KpiMini label="Sent"    value={sent} />
      <KpiMini label="Pos R"   value={positive} tone="violet" />
      <KpiMini label="Unq R"   value={unique}   tone="amber" />
      <KpiMini label="Replied" value={replied}  tone="emerald" />
      <KpiMini label="Bounced" value={bounced}  tone="rose" />
    </div>
  );
}

function KpiMini({ label, value, tone }: { label: string; value: number; tone?: "violet" | "amber" | "emerald" | "rose" }) {
  const accent =
    tone === "violet" ? "text-[#6800FF]" :
    tone === "amber" ? "text-amber-600" :
    tone === "emerald" ? "text-emerald-700" :
    tone === "rose" ? "text-rose-600" : "text-slate-900";
  return (
    <div className="px-1.5 py-1 text-center">
      <p className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400 leading-none">{label}</p>
      <p className={`text-[12px] font-bold tabular-nums leading-tight mt-0.5 ${accent}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function DefaultOverview({ totals, campaignCount }: { totals: { leads: number; sent: number; positiveReply: number; uniqueReply: number; replied: number; bounced: number }; campaignCount: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6800FF] to-[#9F5BFF] text-white flex items-center justify-center shadow-lg shadow-[#6800FF]/20 mb-4">
        <Megaphone size={28} />
      </div>
      <p className="text-[14px] font-bold text-slate-800">Pick a campaign or open a reply</p>
      <p className="text-[12px] text-slate-500 mt-1 max-w-md">
        {campaignCount === 0
          ? "No campaigns linked to this client yet."
          : "Choose a campaign from the left to see its metrics and replies, or click any thread to view the full conversation."}
      </p>
      <div className="mt-6 grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-2xl">
        <OverviewKpi label="Leads"          value={totals.leads} />
        <OverviewKpi label="Sent"           value={totals.sent} />
        <OverviewKpi label="Positive Reply" value={totals.positiveReply} tone="violet" />
        <OverviewKpi label="Unique Reply"   value={totals.uniqueReply}   tone="amber" />
        <OverviewKpi label="Replied"        value={totals.replied}       tone="emerald" />
        <OverviewKpi label="Bounced"        value={totals.bounced}       tone="rose" />
      </div>
    </div>
  );
}

function OverviewKpi({ label, value, tone }: { label: string; value: number; tone?: "violet" | "amber" | "emerald" | "rose" }) {
  const accent =
    tone === "violet" ? "text-[#6800FF]" :
    tone === "amber" ? "text-amber-600" :
    tone === "emerald" ? "text-emerald-700" :
    tone === "rose" ? "text-rose-600" : "text-slate-900";
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-none">{label}</p>
      <p className={`text-[15px] font-bold tabular-nums leading-tight mt-1 ${accent}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function CampaignOverview({ campaign, detail, detailLoading }: { campaign: CampaignRow; detail: CampaignDetailResp | null; detailLoading: boolean }) {
  const [tab, setTab] = useState<"overview" | "sequence" | "schedule">("overview");
  const leads = toNum(campaign.total_count);
  const sent = toNum(campaign.sent_count);
  const positive = toNum(campaign.positive_reply_count);
  const unique = toNum(campaign.unique_reply_count);
  const replied = toNum(campaign.reply_count);
  const bounced = toNum(campaign.bounce_count);
  const unsubs = toNum(campaign.unsubscribed_count);
  const status = (campaign.status || "").toLowerCase();
  const statusCls =
    status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    status === "paused" ? "bg-amber-50 text-amber-700 border-amber-200" :
    status === "completed" ? "bg-slate-100 text-slate-600 border-slate-200" :
    "bg-slate-50 text-slate-500 border-slate-200";

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-bold text-slate-900 truncate">{campaign.name}</h3>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusCls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusDotCls(campaign.status)}`} />
              {campaign.status}
            </span>
            <a
              href={`https://app.smartlead.ai/app/email-campaign/${campaign.campaign_id}/analytics`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in Smartlead"
              className="text-slate-400 hover:text-[#6800FF]"
            >
              <ExternalLink size={11} />
            </a>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">#{campaign.campaign_id}{campaign.created_at ? ` · Created ${new Date(campaign.created_at).toLocaleDateString()}` : ""}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {([
            { key: "overview" as const, label: "Overview" },
            { key: "sequence" as const, label: "Sequence" },
            { key: "schedule" as const, label: "Schedule" },
          ]).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                  active ? "bg-[#6800FF] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {tab === "overview" && (
          <>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Performance</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <OverviewKpi label="Leads"          value={leads} />
                <OverviewKpi label="Sent"           value={sent} />
                <OverviewKpi label="Positive Reply" value={positive} tone="violet" />
                <OverviewKpi label="Unique Reply"   value={unique}   tone="amber" />
                <OverviewKpi label="Replied"        value={replied}  tone="emerald" />
                <OverviewKpi label="Bounced"        value={bounced}  tone="rose" />
              </div>
              {unsubs > 0 && (
                <p className="text-[10.5px] text-slate-500 mt-2"><MailX size={10} className="inline mr-1 -mt-0.5" />{unsubs.toLocaleString()} unsubscribed</p>
              )}
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center text-[12px] text-slate-500">
              Pick a reply from the inbox on the left to read the full conversation.
            </div>
          </>
        )}
        {tab === "sequence" && (
          detailLoading ? (
            <div className="flex items-center justify-center py-14 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin mr-2" /> Loading sequence…
            </div>
          ) : (
            <SequenceBlock sequences={detail?.sequences || []} accounts={detail?.accounts || []} />
          )
        )}
        {tab === "schedule" && (
          detailLoading ? (
            <div className="flex items-center justify-center py-14 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin mr-2" /> Loading schedule…
            </div>
          ) : (
            <ScheduleBlock schedule={detail?.schedule || null} unsubs={unsubs} />
          )
        )}
      </div>
    </div>
  );
}

function ThreadView({ thread, messages, loading, onBack }: { thread: InboxThreadRow; messages: InboxMessageRow[]; loading: boolean; onBack: () => void }) {
  const fullName = `${thread.leadFirstName || ""} ${thread.leadLastName || ""}`.trim() || thread.leadEmail || "Unknown";
  const cat = categoryStyle(thread.category);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button onClick={onBack} className="lg:hidden p-1.5 -ml-1 rounded text-slate-400 hover:bg-slate-100" title="Back">
            <X size={15} />
          </button>
          <div className="shrink-0 w-10 h-10 rounded-lg bg-[#f0e6ff] text-[#6800FF] flex items-center justify-center text-[13px] font-bold uppercase">
            {(fullName.charAt(0) || "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[15px] font-bold text-slate-900 truncate">{fullName}</h3>
              {thread.category && (
                <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cat.bg} ${cat.text} ${cat.border}`}>{thread.category}</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {thread.leadEmail}
              {thread.leadCompany && <span className="text-slate-400"> · {thread.leadCompany}</span>}
              {thread.leadTitle && <span className="text-slate-400"> · {thread.leadTitle}</span>}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
              <Megaphone size={9} />
              {thread.campaignName || `Campaign #${thread.campaignId}`}
            </p>
          </div>
        </div>
        <button onClick={onBack} className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 rounded-md transition-colors">
          <X size={12} /> Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/40 p-6 space-y-3">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-500">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">No messages in this thread yet.</div>
        ) : (
          messages.map((m, i) => {
            const isReply = isReplyType(m.type);
            return (
              <div
                key={i}
                className={`rounded-xl border p-4 shadow-sm ${isReply ? "bg-white border-violet-200 ring-1 ring-violet-100" : "bg-white border-slate-200"}`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-900 truncate flex items-center gap-1.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${isReply ? "bg-violet-500" : "bg-slate-300"}`} />
                      {isReply ? "Reply from" : "Sent to"}: <span className="font-mono text-slate-600">{isReply ? (m.fromEmail || "—") : (m.toEmail || "—")}</span>
                    </p>
                    {m.subject && <p className="text-[11px] text-slate-500 truncate mt-0.5">{isReply ? "Re: " : ""}{m.subject}</p>}
                  </div>
                  <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                    {m.time ? new Date(m.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                  </span>
                </div>
                <EmailBody html={m.body || ""} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SequenceBlock({ sequences, accounts }: { sequences: SequenceStep[]; accounts: EmailAccount[] }) {
  const [openStep, setOpenStep] = useState<number | null>(0);
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email sequence</p>
          <p className="text-[11px] text-slate-400">{sequences.length} step{sequences.length === 1 ? "" : "s"}</p>
        </div>
        {sequences.length === 0 ? (
          <div className="text-xs text-slate-400 italic">No sequence steps configured.</div>
        ) : (
          <div className="space-y-2">
            {sequences.map((s, idx) => {
              const delay = s.seq_delay_details?.delay_in_days ?? 0;
              const isOpen = openStep === idx;
              const variants = s.sequence_variants || [];
              return (
                <div key={s.id || idx} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenStep(isOpen ? null : idx)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-[#6800FF] to-[#9F5BFF] text-white text-xs font-bold shrink-0 shadow-sm">
                      {s.seq_number ?? idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{s.subject || "(no subject)"}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Clock size={10} />
                        {idx === 0 ? "Sent immediately" : `${delay} day${delay === 1 ? "" : "s"} after previous`}
                        {variants.length > 1 && <span className="ml-2">· {variants.length} variants</span>}
                      </p>
                    </div>
                    <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-3">
                      {variants.length > 1 ? (
                        variants.map((v, vIdx) => (
                          <div key={vIdx} className="rounded-md bg-white border border-slate-200 p-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Variant {v.variant_label || String.fromCharCode(65 + vIdx)}</p>
                            <p className="text-sm font-semibold text-slate-900 mb-2">{v.subject || "(no subject)"}</p>
                            <EmailBody html={v.email_body || ""} />
                          </div>
                        ))
                      ) : (
                        <div className="rounded-md bg-white border border-slate-200 p-3">
                          <EmailBody html={s.email_body || ""} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sending accounts</p>
          <p className="text-[11px] text-slate-400">{accounts.length}</p>
        </div>
        {accounts.length === 0 ? (
          <div className="text-xs text-slate-400 italic">No email accounts attached.</div>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {accounts.map((a, i) => (
              <li key={a.id || i} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Mail size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{a.from_name || a.from_email || "Unknown"}</p>
                  <p className="text-[11px] text-slate-500 truncate font-mono">{a.from_email}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-slate-700 tabular-nums">{(a.daily_sent_count ?? 0)} / {(a.message_per_day ?? 0)}</p>
                  <p className="text-[10px] text-slate-400">sent today</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ScheduleBlock({ schedule, unsubs }: { schedule: CampaignDetailResp["schedule"]; unsubs: number }) {
  const scheduleDays = schedule?.days_of_the_week?.map((d) => DAYS[d] || String(d));
  return (
    <div className="space-y-4">
      {!schedule ? (
        <div className="text-xs text-slate-400 italic">Schedule unavailable.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ScheduleField icon={CalendarClock} label="Timezone"        value={schedule.timezone || "—"} />
            <ScheduleField icon={Clock}         label="Sending window"  value={`${schedule.start_hour || "—"} – ${schedule.end_hour || "—"}`} />
            <ScheduleField icon={Clock}         label="Min gap"         value={schedule.min_time_btw_emails ? `${schedule.min_time_btw_emails} min` : "—"} />
            <ScheduleField icon={Send}          label="Max new leads/day" value={schedule.max_new_leads_per_day ? String(schedule.max_new_leads_per_day) : "—"} />
          </div>
          {scheduleDays && scheduleDays.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Sending days</p>
              <div className="flex items-center gap-1.5">
                {DAYS.map((d) => {
                  const on = scheduleDays.includes(d);
                  return (
                    <span
                      key={d}
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-[11px] font-bold ${
                        on ? "bg-[#6800FF] text-white" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {d.charAt(0)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      {unsubs > 0 && (
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
          <MailX size={11} />
          {unsubs.toLocaleString()} unsubscribed
        </div>
      )}
    </div>
  );
}

function ScheduleField({ icon: Icon, label, value }: { icon: typeof Send; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-white">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
        <Icon size={12} />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xs font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EmailBody({ html }: { html: string }) {
  if (!html) return <p className="text-xs text-slate-400 italic">No body content.</p>;
  return (
    <div
      className="prose prose-sm max-w-none text-slate-700 text-[13px] leading-relaxed [&_p]:my-2 [&_a]:text-[#6800FF] [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
