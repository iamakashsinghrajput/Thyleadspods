"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Inbox, Search, RefreshCw, Loader2, Mail, ChevronLeft, ChevronDown, ChevronRight, ArrowDownRight, ArrowUpRight, Check } from "lucide-react";

type Thread = {
  threadKey: string;
  leadId: number;
  campaignId: number;
  campaignName: string;
  campaignStatus: string;
  leadFirstName: string;
  leadLastName: string;
  leadEmail: string;
  leadCompany: string;
  leadTitle: string;
  category: string;
  replyCount: number;
  lastReplyAt: string;
  lastReplyPreview: string;
  lastReplySubject: string;
  locallyReadAt: string | null;
};

type CampaignFacet = { id: number; name: string; count: number; client?: string };
type CategoryFacet = { key: string; count: number };
type ClientFacet = { name: string; count: number; campaigns: { id: number; name: string; count: number }[] };

type SyncProgress = {
  stage?: string;
  campaignsTotal?: number;
  campaignsProcessed?: number;
  currentCampaign?: string;
  leadsScanned?: number;
  threadsPersisted?: number;
};

type ListResponse = {
  threads: Thread[];
  total: number;
  unreadCount: number;
  facets: { campaigns: CampaignFacet[]; categories: CategoryFacet[]; clients?: ClientFacet[] };
  availableCategories?: { id: number; name: string; description: string }[];
  sync: {
    lastSyncedAt: string | null;
    syncingAt: string | null;
    heartbeatAt?: string | null;
    cancelRequested?: boolean;
    progress?: SyncProgress | null;
    stale: boolean;
    lastError: string;
  };
};

type Message = {
  messageId: string;
  threadKey: string;
  leadId: number;
  campaignId: number;
  time: string | null;
  type: string;
  subject: string;
  body: string;
  fromEmail: string;
  toEmail: string;
};

type ThreadResponse = { thread: Thread | null; messages: Message[] };

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtThreadTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const sameYear = d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (sameYear) {
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function initials(first: string, last: string, email: string): string {
  const a = (first || "").trim().charAt(0).toUpperCase();
  const b = (last || "").trim().charAt(0).toUpperCase();
  if (a || b) return (a + b) || a || b;
  return (email || "?").charAt(0).toUpperCase();
}

function categoryStyle(cat: string): { bg: string; text: string; border: string } {
  const v = (cat || "").toLowerCase();
  if (/interest|positive|book|meeting|qualified/.test(v)) return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
  if (/not.*interest|negative|reject/.test(v))           return { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" };
  if (/out.*of.*office|ooo|vacation|holiday/.test(v))   return { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" };
  if (/wrong.*person|forward/.test(v))                  return { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200" };
  if (/bounce|invalid|unsub|do.*not.*contact|block/.test(v)) return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };
  if (/sender.*originat/.test(v))                       return { bg: "bg-slate-50",   text: "text-slate-600",   border: "border-slate-200" };
  if (/info|later/.test(v))                             return { bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200" };
  return { bg: "bg-[#f0e6ff]", text: "text-[#6800FF]", border: "border-[#6800FF]/20" };
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6800FF 0%, #9b5cff 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)",
  "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
  "linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)",
  "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)",
  "linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)",
  "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
];
function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

export default function MasterInboxPage() {
  const { user, hydrated } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [threadData, setThreadData] = useState<ThreadResponse | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [campaign, setCampaign] = useState<string>("all");
  const [client, setClient] = useState<string>("all");
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [clientsOpen, setClientsOpen] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const canAccess = !!user && ["admin", "superadmin"].includes(user.role);

  const fetchList = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        actor: user.email,
        campaign,
        client,
        category: categories.size > 0 ? Array.from(categories).join(",") : "all",
        unread: unreadOnly ? "1" : "0",
      });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/inbox?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to load inbox"); return; }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [user?.email, campaign, client, categories, unreadOnly, search]);

  useEffect(() => { if (canAccess) void fetchList(); }, [fetchList, canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    const isSyncing = !!data?.sync?.syncingAt;
    const interval = isSyncing ? 5_000 : 15_000;
    const t = setInterval(() => { void fetchList(); }, interval);
    const onVisible = () => { if (document.visibilityState === "visible") void fetchList(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [canAccess, fetchList, data?.sync?.syncingAt]);

  const loadThread = useCallback(async (key: string) => {
    if (!user?.email) return;
    const [leadId, campaignId] = key.split(":");
    setSelectedKey(key);
    setThreadLoading(true);
    setThreadData(null);
    try {
      const res = await fetch(`/api/inbox/thread/${leadId}/${campaignId}?actor=${encodeURIComponent(user.email)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to load thread"); return; }
      setThreadData(json);
      void fetch(`/api/inbox/thread/${leadId}/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: user.email, action: "mark-read" }),
      });
      setData((prev) => prev ? { ...prev, threads: prev.threads.map((t) => t.threadKey === key ? { ...t, locallyReadAt: new Date().toISOString() } : t), unreadCount: Math.max(0, prev.unreadCount - (prev.threads.find((t) => t.threadKey === key && !t.locallyReadAt) ? 1 : 0)) } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setThreadLoading(false);
    }
  }, [user?.email]);

  async function triggerSync() {
    if (!user?.email) return;
    setSyncing(true);
    try {
      await fetch(`/api/inbox/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: user.email }),
      });
      await fetchList();
    } finally {
      setSyncing(false);
    }
  }

  async function cancelSync() {
    if (!user?.email) return;
    await fetch(`/api/inbox/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: user.email, action: "cancel" }),
    });
    await fetchList();
  }

  async function forceUnlock() {
    if (!user?.email) return;
    await fetch(`/api/inbox/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: user.email, action: "force-unlock" }),
    });
    await fetchList();
  }

  const filteredThreads = data?.threads ?? [];

  const selectedThread = useMemo(() => {
    if (!selectedKey || !data) return null;
    return data.threads.find((t) => t.threadKey === selectedKey) || threadData?.thread || null;
  }, [selectedKey, data, threadData]);

  if (!hydrated) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (!canAccess) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-600">You don&apos;t have access to the Master Inbox.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#f0e6ff] text-[#6800FF] flex items-center justify-center">
            <Inbox size={16} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Master Inbox</h1>
            <p className="text-[11px] text-slate-500">
              {data?.total != null ? `${data.total.toLocaleString()} threads · ` : ""}
              {data?.unreadCount != null ? `${data.unreadCount} unread` : ""}
              {data?.sync?.lastSyncedAt && (
                <span className="text-slate-400"> · Synced {relativeTime(data.sync.lastSyncedAt)}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data?.sync?.syncingAt && (() => {
            const p = data.sync.progress || {};
            const total = p.campaignsTotal || 0;
            const done = p.campaignsProcessed || 0;
            const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
            const stuck = data.sync.heartbeatAt && Date.now() - new Date(data.sync.heartbeatAt).getTime() > 90_000;
            return (
              <div className="flex items-center gap-2">
                <div className="flex flex-col text-[11px] text-slate-600 min-w-[180px]">
                  <div className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin text-[#6800FF]" />
                    <span className="font-semibold">
                      {data.sync.cancelRequested ? "Cancelling…" : stuck ? "Sync stalled" : "Syncing"}
                    </span>
                    {total > 0 && <span className="text-slate-400 tabular-nums">{done}/{total}</span>}
                    {(p.threadsPersisted || 0) > 0 && <span className="text-slate-400">· {p.threadsPersisted} threads</span>}
                  </div>
                  {p.currentCampaign && <p className="text-[10px] text-slate-400 truncate max-w-[260px]">{p.currentCampaign}</p>}
                  {total > 0 && (
                    <div className="h-1 mt-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#6800FF] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                {!data.sync.cancelRequested && (
                  <button
                    onClick={cancelSync}
                    className="inline-flex items-center px-2 py-1 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
                {stuck && (
                  <button
                    onClick={forceUnlock}
                    className="inline-flex items-center px-2 py-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    Force unlock
                  </button>
                )}
              </div>
            );
          })()}
          <button
            onClick={triggerSync}
            disabled={syncing || !!data?.sync?.syncingAt}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
          >
            <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> {syncing ? "Starting" : "Sync now"}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          <div className="p-3 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-2">Status</p>
              <div className="space-y-0.5">
                <SidebarItem label="All threads" count={data?.total ?? 0} active={!unreadOnly} onClick={() => setUnreadOnly(false)} />
                <SidebarItem label="Unread" count={data?.unreadCount ?? 0} active={unreadOnly} onClick={() => setUnreadOnly(true)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 px-2">
                <button
                  onClick={() => setCategoriesOpen((v) => !v)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                >
                  {categoriesOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  Categories
                  {categories.size > 0 && (
                    <span className="ml-1 px-1.5 py-px rounded-full bg-[#6800FF] text-white text-[9px] tabular-nums">{categories.size}</span>
                  )}
                </button>
                {categories.size > 0 && (
                  <button
                    onClick={() => setCategories(new Set())}
                    className="text-[10px] font-semibold text-slate-400 hover:text-red-600"
                  >
                    Clear
                  </button>
                )}
              </div>
              {categoriesOpen && (
              <div className="space-y-0.5">
                {(data?.facets.categories ?? []).length === 0 && (
                  <p className="text-[11px] text-slate-400 px-2 py-1">No categories yet</p>
                )}
                {(data?.facets.categories ?? []).map((c) => {
                  const checked = categories.has(c.key);
                  return (
                    <button
                      key={c.key}
                      onClick={() => {
                        setCategories((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.key)) next.delete(c.key);
                          else next.add(c.key);
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
                  onClick={() => setClientsOpen((v) => !v)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
                >
                  {clientsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  Clients
                  {client !== "all" && (
                    <span className="ml-1 px-1.5 py-px rounded-full bg-[#6800FF] text-white text-[9px]">1</span>
                  )}
                </button>
                {(client !== "all" || campaign !== "all") && (
                  <button
                    onClick={() => { setClient("all"); setCampaign("all"); }}
                    className="text-[10px] font-semibold text-slate-400 hover:text-red-600"
                  >
                    Clear
                  </button>
                )}
              </div>
              {clientsOpen && (
              <div className="space-y-0.5">
                <SidebarItem
                  label="All clients"
                  count={data?.total ?? 0}
                  active={client === "all" && campaign === "all"}
                  onClick={() => { setClient("all"); setCampaign("all"); }}
                />
                {(data?.facets.clients ?? []).map((cli) => {
                  const isExpanded = expandedClients.has(cli.name);
                  const isClientActive = client === cli.name && campaign === "all";
                  return (
                    <div key={cli.name}>
                      <div className="flex items-stretch">
                        <button
                          onClick={() => {
                            setClient(cli.name);
                            setCampaign("all");
                          }}
                          className={`flex-1 min-w-0 text-left px-2 py-1.5 rounded-l-lg text-xs flex items-center justify-between gap-2 transition-colors ${
                            isClientActive ? "bg-[#f0e6ff] text-[#6800FF] font-semibold" : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="truncate">{cli.name}</span>
                          <span className={`text-[10px] tabular-nums shrink-0 ${isClientActive ? "text-[#6800FF]" : "text-slate-400"}`}>{cli.count}</span>
                        </button>
                        <button
                          onClick={() => {
                            setExpandedClients((prev) => {
                              const next = new Set(prev);
                              if (next.has(cli.name)) next.delete(cli.name);
                              else next.add(cli.name);
                              return next;
                            });
                          }}
                          className="px-1.5 rounded-r-lg text-slate-400 hover:bg-slate-50"
                          aria-label={isExpanded ? "Collapse campaigns" : "Show campaigns"}
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="ml-3 mt-0.5 pl-2 border-l border-slate-200 space-y-0.5">
                          {cli.campaigns.length === 0 && (
                            <p className="text-[10px] text-slate-400 px-2 py-1">No campaigns</p>
                          )}
                          {cli.campaigns.map((c) => {
                            const isActive = campaign === String(c.id);
                            return (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setClient(cli.name);
                                  setCampaign(String(c.id));
                                }}
                                className={`w-full text-left px-2 py-1 rounded text-[11px] flex items-center justify-between gap-2 transition-colors ${
                                  isActive ? "bg-[#6800FF] text-white font-semibold" : "text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <span className="truncate">{c.name}</span>
                                <span className={`text-[10px] tabular-nums shrink-0 ${isActive ? "text-white/80" : "text-slate-400"}`}>{c.count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        </aside>

        <section className="w-[380px] shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="px-3 py-2.5 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lead, company, subject…"
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && filteredThreads.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin mr-2" /> Loading…
              </div>
            ) : error ? (
              <div className="p-4 m-3 text-xs text-amber-800 bg-amber-50 rounded-lg">{error}</div>
            ) : filteredThreads.length === 0 ? (
              <div className="text-center py-14 px-4 text-sm text-slate-400">
                <Inbox size={22} className="text-slate-300 mx-auto mb-2" />
                {data?.sync?.lastSyncedAt ? "No threads match these filters." : "No threads yet. Click Sync now to import replies."}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredThreads.map((t) => {
                  const unread = !t.locallyReadAt;
                  const name = `${t.leadFirstName} ${t.leadLastName}`.trim() || t.leadEmail || "Unknown";
                  const active = selectedKey === t.threadKey;
                  const catStyle = categoryStyle(t.category);
                  const avatarStyle = avatarGradient(t.leadFirstName + t.leadLastName + t.leadEmail);
                  return (
                    <li key={t.threadKey}>
                      <button
                        onClick={() => loadThread(t.threadKey)}
                        className={`w-full text-left px-3.5 py-3 flex gap-3 transition-colors border-l-2 ${
                          active
                            ? "bg-[#f0e6ff] border-l-[#6800FF]"
                            : unread
                              ? "border-l-[#6800FF]/30 hover:bg-slate-50"
                              : "border-l-transparent hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm ${active ? "bg-[#6800FF] text-white" : "text-white"}`}
                          style={active ? undefined : { background: avatarStyle }}
                        >
                          {initials(t.leadFirstName, t.leadLastName, t.leadEmail)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-[13px] truncate ${unread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{name}</p>
                            <span className="text-[10px] text-slate-400 shrink-0 ml-auto tabular-nums whitespace-nowrap" title={new Date(t.lastReplyAt).toLocaleString()}>{fmtThreadTime(t.lastReplyAt)}</span>
                          </div>
                          {t.leadCompany && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{t.leadCompany}{t.leadTitle ? <span className="text-slate-400"> · {t.leadTitle}</span> : null}</p>
                          )}
                          {(t.lastReplySubject || t.lastReplyPreview) && (
                            <p className={`text-[11px] truncate mt-0.5 ${unread ? "text-slate-700 font-medium" : "text-slate-500"}`}>
                              {t.lastReplySubject || t.lastReplyPreview}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {t.campaignName && (
                              <span className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 truncate max-w-[160px]" title={t.campaignName}>
                                {t.campaignName}
                              </span>
                            )}
                            {t.category && (
                              <span className={`inline-flex items-center text-[10px] font-semibold rounded px-1.5 py-0.5 border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                                {t.category}
                              </span>
                            )}
                            {t.replyCount > 1 && (
                              <span className="text-[10px] text-slate-400">{t.replyCount} replies</span>
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

        <section className="flex-1 bg-white min-w-0 flex flex-col">
          {!selectedKey ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Mail size={32} className="text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-500">Select a conversation</p>
              <p className="text-xs text-slate-400 mt-1">Pick a thread from the left to view the full email exchange.</p>
            </div>
          ) : (
            <ThreadView
              thread={selectedThread}
              messages={threadData?.messages || []}
              loading={threadLoading}
              onBack={() => setSelectedKey(null)}
              availableCategories={data?.availableCategories || []}
              onChangeCategory={async (categoryId, categoryName) => {
                if (!user?.email || !selectedKey) return;
                const [leadId, campaignId] = selectedKey.split(":");
                const res = await fetch(`/api/inbox/thread/${leadId}/${campaignId}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ actor: user.email, action: "set-category", categoryId, categoryName }),
                });
                if (!res.ok) {
                  const j = await res.json().catch(() => ({}));
                  throw new Error(j.error || "Failed to update Smartlead");
                }
                setData((prev) => prev ? {
                  ...prev,
                  threads: prev.threads.map((t) => t.threadKey === selectedKey ? { ...t, category: categoryName } : t),
                } : prev);
                setThreadData((prev) => prev && prev.thread ? { ...prev, thread: { ...prev.thread, category: categoryName } } : prev);
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function SidebarItem({ label, count, active, onClick, hideCount }: { label: string; count: number; active: boolean; onClick: () => void; hideCount?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
        active ? "bg-[#f0e6ff] text-[#6800FF] font-semibold" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className="truncate">{label}</span>
      {!hideCount && count > 0 && (
        <span className={`text-[10px] tabular-nums shrink-0 ml-2 ${active ? "text-[#6800FF]" : "text-slate-400"}`}>{count}</span>
      )}
    </button>
  );
}

function ThreadView({
  thread,
  messages,
  loading,
  onBack,
  availableCategories,
  onChangeCategory,
}: {
  thread: Thread | null;
  messages: Message[];
  loading: boolean;
  onBack: () => void;
  availableCategories: { id: number; name: string; description: string }[];
  onChangeCategory: (categoryId: number, categoryName: string) => Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [updateError, setUpdateError] = useState("");
  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        {loading ? <><Loader2 size={14} className="animate-spin mr-2" /> Loading thread…</> : "Thread unavailable"}
      </div>
    );
  }
  const name = `${thread.leadFirstName} ${thread.leadLastName}`.trim() || thread.leadEmail || "Unknown";
  const cat = categoryStyle(thread.category);
  async function pick(c: { id: number; name: string }) {
    setUpdateError("");
    setUpdatingCategory(true);
    try {
      await onChangeCategory(c.id, c.name);
      setPickerOpen(false);
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : "Failed to update category");
    } finally {
      setUpdatingCategory(false);
    }
  }
  const threadSubject = (messages.find((m) => m.subject)?.subject || thread.lastReplySubject || "").replace(/^(re:|fwd:)\s*/i, "");
  const avatarBg = avatarGradient(thread.leadFirstName + thread.leadLastName + thread.leadEmail);
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="px-6 pt-5 pb-4 border-b border-slate-200">
        <div className="flex items-start gap-4">
          <button onClick={onBack} className="lg:hidden p-1 rounded text-slate-400 hover:bg-slate-100 shrink-0" aria-label="Back">
            <ChevronLeft size={16} />
          </button>
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0"
            style={{ background: avatarBg }}
          >
            {initials(thread.leadFirstName, thread.leadLastName, thread.leadEmail)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900 truncate leading-tight">{name}</h2>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              <a href={`mailto:${thread.leadEmail}`} className="hover:text-[#6800FF]">{thread.leadEmail}</a>
              {(thread.leadCompany || thread.leadTitle) && <span className="text-slate-300"> · </span>}
              {thread.leadCompany}
              {thread.leadTitle && <span className="text-slate-400"> · {thread.leadTitle}</span>}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <p className="text-[11px] text-slate-400 tabular-nums" title={new Date(thread.lastReplyAt).toLocaleString()}>{fmtThreadTime(thread.lastReplyAt)}</p>
            <div className="relative">
              <button
                onClick={() => setPickerOpen((v) => !v)}
                disabled={updatingCategory || availableCategories.length === 0}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-1 border transition-colors hover:opacity-90 disabled:opacity-60 ${cat.bg} ${cat.text} ${cat.border}`}
                title="Change category — syncs to Smartlead"
              >
                {updatingCategory && <Loader2 size={10} className="animate-spin" />}
                {thread.category || "Set category"}
                <ChevronDown size={11} />
              </button>
              {pickerOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
                  <div className="absolute z-40 right-0 mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                    {availableCategories.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-400">No categories configured in Smartlead.</p>
                    ) : (
                      availableCategories.map((c) => {
                        const s = categoryStyle(c.name);
                        const selected = thread.category === c.name;
                        return (
                          <button
                            key={c.id}
                            onClick={() => void pick(c)}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 ${selected ? "bg-slate-50" : ""}`}
                          >
                            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border ${selected ? `${s.bg} ${s.text} ${s.border}` : "border-slate-200 bg-white text-transparent"}`}>
                              <Check size={10} />
                            </span>
                            <span className="flex-1 truncate font-medium text-slate-700">{c.name}</span>
                            <span className={`w-2 h-2 rounded-full ${s.bg.replace("50", "400").replace("100", "400")}`} />
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
            {updateError && <span className="text-[10px] text-rose-600 max-w-[200px] text-right">{updateError}</span>}
          </div>
        </div>
        {(threadSubject || thread.campaignName) && (
          <div className="mt-3 pl-15 flex items-center gap-2 flex-wrap">
            {threadSubject && <h3 className="text-sm font-semibold text-slate-800 truncate">{threadSubject}</h3>}
            {thread.campaignName && (
              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 truncate max-w-[200px]" title={thread.campaignName}>
                {thread.campaignName}
              </span>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50/40">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-3">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin mr-2" /> Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400">No messages in this thread yet.</div>
          ) : (
            messages.map((m, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null;
              const stripSubject = (s: string) => (s || "").replace(/^(re:|fwd:)\s*/i, "").trim();
              const showSubject = !prev || stripSubject(m.subject) !== stripSubject(prev.subject);
              return <MessageCard key={m.messageId} message={m} showSubject={showSubject} />;
            })
          )}
        </div>
      </div>
    </div>
  );
}

function MessageCard({ message, showSubject }: { message: Message; showSubject?: boolean }) {
  const isReply = (message.type || "").toUpperCase() === "REPLY";
  const partyEmail = isReply ? message.fromEmail : message.toEmail;
  const fmtTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };
  const label = isReply ? "Reply from" : "Sent to";
  return (
    <div className={`rounded-xl bg-white border ${isReply ? "border-emerald-200/70" : "border-slate-200"} shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden`}>
      {/* Direction tag + sender row */}
      <div className="px-5 pt-4 pb-2 flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
          isReply ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
        }`}>
          {isReply ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
          {label}
        </span>
        <span className="text-xs font-semibold text-slate-700 truncate min-w-0 flex-1" title={partyEmail}>{partyEmail || "(unknown)"}</span>
        <span className="text-[11px] text-slate-400 tabular-nums shrink-0 whitespace-nowrap">{fmtTime(message.time)}</span>
      </div>
      {showSubject && message.subject && (
        <p className="px-5 pb-1 text-[12px] font-medium text-slate-600 truncate" title={message.subject}>{message.subject}</p>
      )}
      <div className="px-5 pb-5 pt-2">
        {message.body ? (
          <div
            className="prose prose-sm max-w-none text-[13.5px] leading-[1.65] text-slate-700 [&_a]:text-[#6800FF] [&_a]:underline [&_p]:my-2.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
            dangerouslySetInnerHTML={{ __html: message.body }}
          />
        ) : (
          <p className="text-xs text-slate-400 italic">No body content.</p>
        )}
      </div>
    </div>
  );
}
