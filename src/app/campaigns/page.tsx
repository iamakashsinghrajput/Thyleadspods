"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Search, Loader2, ExternalLink, RefreshCw, Megaphone } from "lucide-react";

type CampaignRow = {
  id: number;
  name: string;
  status: string;
  createdAt: string | null;
  sentCount: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  bounceCount: number;
  unsubscribedCount: number;
  totalCount: number;
  uniqueOpenCount: number;
  uniqueClickCount: number;
  uniqueReplyCount: number;
  positiveReplyCount: number;
};

type Counts = { all: number; active: number; paused: number; stopped: number; completed: number; drafted: number };

type ListResponse = {
  campaigns: CampaignRow[];
  counts: Counts;
  source?: "cache" | "stale" | "fresh";
  refreshing?: boolean;
  updatedAt?: string | null;
};

type Tab = "all" | "active" | "paused" | "stopped" | "completed";

function pct(num: number, denom: number): string {
  if (!denom) return "0%";
  return `${((num / denom) * 100).toFixed(num / denom >= 0.1 ? 1 : 2)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `Created ${month} ${day}, ${String(h).padStart(2, "0")}:${mm} ${ampm}`;
}

function statusStyle(s: string): { bg: string; text: string; dot: string; label: string } {
  const v = s.toLowerCase();
  if (v === "active") return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Active" };
  if (v === "paused") return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Paused" };
  if (v === "stopped") return { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", label: "Stopped" };
  if (v === "completed") return { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500", label: "Completed" };
  if (v === "drafted") return { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", label: "Drafted" };
  return { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", label: s || "Unknown" };
}

export default function CampaignsPage() {
  const { user, hydrated } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const canAccess = !!user && ["admin", "superadmin"].includes(user.role);

  const fetchList = useCallback(async (manual?: boolean) => {
    if (!user?.email) return;
    if (manual) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ actor: user.email });
      if (manual) params.set("fresh", "1");
      const res = await fetch(`/api/campaigns/list?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to load campaigns"); return; }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.email]);

  useEffect(() => { if (canAccess) void fetchList(); }, [fetchList, canAccess]);

  // If we got stale data, the server kicked off a background refresh.
  // Poll once after 8s to pick up the fresh result.
  useEffect(() => {
    if (data?.source === "stale" && data?.refreshing) {
      const t = setTimeout(() => { void fetchList(); }, 8_000);
      return () => clearTimeout(t);
    }
  }, [data?.source, data?.refreshing, fetchList]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.campaigns;
    if (tab !== "all") rows = rows.filter((r) => r.status === tab);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    return rows;
  }, [data, tab, search]);

  if (!hydrated) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (!canAccess) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-600">You don&apos;t have access to Master Campaigns.</p>
      </div>
    );
  }

  const counts = data?.counts;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "all", label: "All Campaigns", count: counts?.all },
    { key: "active", label: "Active", count: counts?.active },
    { key: "paused", label: "Paused", count: counts?.paused },
    { key: "stopped", label: "Stopped", count: counts?.stopped },
    { key: "completed", label: "Completed", count: counts?.completed },
  ];

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="px-6 pt-6 pb-3 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Email Campaigns</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage and analyze your ongoing and completed outreach campaigns
              {data?.refreshing && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#6800FF]">
                  <Loader2 size={9} className="animate-spin" /> updating in background
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => fetchList(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <div className="flex items-center gap-5 -mb-3">
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`pb-2.5 -mb-px text-[12.5px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${
                    active
                      ? "text-[#6800FF] border-[#6800FF]"
                      : "text-slate-500 hover:text-slate-700 border-transparent"
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 ${active ? "text-[#6800FF]" : "text-slate-400"}`}>
                    ({t.count ?? 0})
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns…"
              className="w-64 pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-400">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading campaigns…
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">
            <Megaphone size={22} className="text-slate-300 mx-auto mb-2" />
            No campaigns found.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="text-left px-4 py-3 w-[36%]">Campaign</th>
                  <th className="text-right px-4 py-3">Leads</th>
                  <th className="text-right px-4 py-3">Sent</th>
                  <th className="text-right px-4 py-3">Positive Reply</th>
                  <th className="text-right px-4 py-3">Unique Reply</th>
                  <th className="text-right px-4 py-3">Replied</th>
                  <th className="text-right px-4 py-3">Bounced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const st = statusStyle(c.status);
                  const positiveReply = c.positiveReplyCount ?? 0;
                  const uniqueReply = c.uniqueReplyCount ?? 0;
                  const replyRate = pct(c.replyCount, c.sentCount);
                  const positiveReplyRate = pct(positiveReply, c.sentCount);
                  const uniqueReplyRate = pct(uniqueReply, c.sentCount);
                  const bounceRate = pct(c.bounceCount, c.sentCount);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/campaigns/${c.id}`)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold ${st.bg} ${st.text}`}>
                            <Megaphone size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13.5px] font-semibold text-slate-900 truncate" title={c.name}>{c.name}</span>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${st.bg} ${st.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                {st.label}
                              </span>
                              <a
                                href={`https://app.smartlead.ai/app/email-campaign/${c.id}/analytics`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open in Smartlead"
                                onClick={(e) => e.stopPropagation()}
                                className="text-slate-400 hover:text-[#6800FF]"
                              >
                                <ExternalLink size={11} />
                              </a>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(c.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[13px] font-semibold text-slate-900 tabular-nums">{c.totalCount.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[13px] font-semibold text-slate-900 tabular-nums">{c.sentCount.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[13px] font-semibold text-violet-700 tabular-nums">{positiveReply.toLocaleString()}</span>
                        <span className="block text-[10px] text-slate-400 tabular-nums">{positiveReplyRate}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[13px] font-semibold text-amber-700 tabular-nums">{uniqueReply.toLocaleString()}</span>
                        <span className="block text-[10px] text-slate-400 tabular-nums">{uniqueReplyRate}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[13px] font-semibold text-emerald-700 tabular-nums">{c.replyCount.toLocaleString()}</span>
                        <span className="block text-[10px] text-slate-400 tabular-nums">{replyRate}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[13px] font-semibold text-rose-700 tabular-nums">{c.bounceCount.toLocaleString()}</span>
                        <span className="block text-[10px] text-slate-400 tabular-nums">{bounceRate}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
