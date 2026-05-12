"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Inbox, Search, RefreshCw, Loader2, Mail, ChevronLeft, ArrowDownRight, ArrowUpRight, Circle } from "lucide-react";

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

type CampaignFacet = { id: number; name: string; count: number };
type CategoryFacet = { key: string; count: number };

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
  facets: { campaigns: CampaignFacet[]; categories: CategoryFacet[] };
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

function initials(first: string, last: string, email: string): string {
  const a = (first || "").trim().charAt(0).toUpperCase();
  const b = (last || "").trim().charAt(0).toUpperCase();
  if (a || b) return (a + b) || a || b;
  return (email || "?").charAt(0).toUpperCase();
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
  const [category, setCategory] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
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
        category,
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
  }, [user?.email, campaign, category, unreadOnly, search]);

  useEffect(() => { if (canAccess) void fetchList(); }, [fetchList, canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    const isSyncing = !!data?.sync?.syncingAt;
    const interval = isSyncing ? 5_000 : 60_000;
    const t = setInterval(() => { void fetchList(); }, interval);
    return () => clearInterval(t);
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
        <aside className="w-60 shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          <div className="p-3 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-2">Status</p>
              <div className="space-y-0.5">
                <SidebarItem label="All threads" count={data?.total ?? 0} active={!unreadOnly} onClick={() => setUnreadOnly(false)} />
                <SidebarItem label="Unread" count={data?.unreadCount ?? 0} active={unreadOnly} onClick={() => setUnreadOnly(true)} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-2">Category</p>
              <div className="space-y-0.5">
                <SidebarItem label="All categories" count={0} hideCount active={category === "all"} onClick={() => setCategory("all")} />
                {(data?.facets.categories ?? []).map((c) => (
                  <SidebarItem key={c.key} label={c.key} count={c.count} active={category === c.key} onClick={() => setCategory(c.key)} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-2">Campaign</p>
              <div className="space-y-0.5">
                <SidebarItem label="All campaigns" count={0} hideCount active={campaign === "all"} onClick={() => setCampaign("all")} />
                {(data?.facets.campaigns ?? []).slice(0, 30).map((c) => (
                  <SidebarItem key={c.id} label={c.name} count={c.count} active={campaign === String(c.id)} onClick={() => setCampaign(String(c.id))} />
                ))}
              </div>
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
                  return (
                    <li key={t.threadKey}>
                      <button
                        onClick={() => loadThread(t.threadKey)}
                        className={`w-full text-left px-3 py-2.5 flex gap-3 transition-colors ${active ? "bg-[#f0e6ff]" : "hover:bg-slate-50"}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${active ? "bg-[#6800FF] text-white" : "bg-slate-100 text-slate-600"}`}>
                          {initials(t.leadFirstName, t.leadLastName, t.leadEmail)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {unread && <span className="w-1.5 h-1.5 rounded-full bg-[#6800FF] shrink-0" />}
                            <p className={`text-[13px] truncate ${unread ? "font-bold text-slate-900" : "font-semibold text-slate-800"}`}>{name}</p>
                            <span className="text-[10px] text-slate-400 shrink-0 ml-auto tabular-nums">{relativeTime(t.lastReplyAt)}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{t.leadCompany || t.leadTitle || t.leadEmail}</p>
                          <p className="text-[11px] text-slate-400 truncate mt-1">{t.campaignName}</p>
                          {(t.category || t.replyCount > 1) && (
                            <div className="flex items-center gap-1 mt-1">
                              {t.category && <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1 py-0.5">{t.category}</span>}
                              {t.replyCount > 1 && <span className="text-[10px] text-slate-400">{t.replyCount} replies</span>}
                            </div>
                          )}
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

function ThreadView({ thread, messages, loading, onBack }: { thread: Thread | null; messages: Message[]; loading: boolean; onBack: () => void }) {
  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        {loading ? <><Loader2 size={14} className="animate-spin mr-2" /> Loading thread…</> : "Thread unavailable"}
      </div>
    );
  }
  const name = `${thread.leadFirstName} ${thread.leadLastName}`.trim() || thread.leadEmail || "Unknown";
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="lg:hidden p-1 rounded text-slate-400 hover:bg-slate-100" aria-label="Back">
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-base font-bold text-slate-900 truncate">{name}</h2>
            {thread.category && <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">{thread.category}</span>}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            <a href={`mailto:${thread.leadEmail}`} className="hover:text-[#6800FF]">{thread.leadEmail}</a>
            {thread.leadCompany && <> · {thread.leadCompany}</>}
            {thread.leadTitle && <> · {thread.leadTitle}</>}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            Campaign: <span className="font-medium text-slate-600">{thread.campaignName}</span> <span className="font-mono text-[10px]">#{thread.campaignId}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Last reply</p>
          <p className="text-[11px] font-semibold text-slate-700 tabular-nums">{relativeTime(thread.lastReplyAt)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-slate-400">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-400">No messages in this thread yet.</div>
        ) : (
          messages.map((m) => <MessageCard key={m.messageId} message={m} />)
        )}
      </div>
    </div>
  );
}

function MessageCard({ message }: { message: Message }) {
  const isReply = (message.type || "").toUpperCase() === "REPLY";
  const Icon = isReply ? ArrowDownRight : ArrowUpRight;
  const tone = isReply ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white";
  const iconColor = isReply ? "text-emerald-600" : "text-slate-500";
  return (
    <div className={`rounded-xl border ${tone} overflow-hidden`}>
      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2 bg-white/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center bg-white border border-slate-200 ${iconColor}`}>
            <Icon size={12} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-700 truncate">
              {isReply ? "Reply from " : "Sent to "}
              <span className="font-bold">{isReply ? message.fromEmail : message.toEmail}</span>
            </p>
            <p className="text-[10px] text-slate-400 truncate">{message.subject || "(no subject)"}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-400 tabular-nums">{message.time ? new Date(message.time).toLocaleString() : ""}</p>
          {!isReply && (
            <div className="flex items-center justify-end gap-2 mt-0.5">
              {message.body && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400" title="Opens">
                  <Circle size={8} /> 0
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 py-3">
        {message.body ? (
          <div
            className="prose prose-sm max-w-none text-[13px] leading-relaxed text-slate-700 [&_a]:text-[#6800FF] [&_a]:underline [&_p]:my-2"
            dangerouslySetInnerHTML={{ __html: message.body }}
          />
        ) : (
          <p className="text-xs text-slate-400 italic">No body content.</p>
        )}
      </div>
    </div>
  );
}
