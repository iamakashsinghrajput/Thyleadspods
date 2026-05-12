"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X, Loader2, ChevronRight, Mail, Send, MailOpen, Reply, MousePointer2, AlertTriangle, MailX, Clock, CalendarClock, Inbox } from "lucide-react";

type CampaignRow = {
  campaign_id: number;
  name: string;
  status: string;
  created_at?: string;
  start_date?: string | null;
  sent_count?: number | string;
  open_count?: number | string;
  unique_open_count?: number | string;
  reply_count?: number | string;
  click_count?: number | string;
  unique_click_count?: number | string;
  bounce_count?: number | string;
  unsubscribed_count?: number | string;
};

type Totals = {
  sent: number; opens: number; replies: number; clicks: number; bounces: number; unsubscribes: number;
  openRate: number; replyRate: number; clickRate: number; bounceRate: number; unsubscribeRate: number;
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
  warmup_details?: { status?: string; daily_sent_count?: number; total_sent_count?: number } | null;
};

type CampaignDetails = {
  campaign: {
    id: number;
    name: string;
    status: string;
    created_at?: string;
    start_date?: string | null;
    track_settings?: unknown;
    scheduler_cron_value?: unknown;
  };
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

const FILTER_DOT: Record<string, string> = {
  slate: "bg-slate-900",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  slate2: "bg-slate-400",
};
const FILTER_RING: Record<string, string> = {
  slate: "ring-slate-900/15 border-slate-900",
  emerald: "ring-emerald-500/15 border-emerald-500",
  amber: "ring-amber-500/15 border-amber-500",
  slate2: "ring-slate-400/15 border-slate-400",
};

function FilterCard({ label, value, sub, dot, active, onClick }: {
  label: string;
  value: number;
  sub: string;
  dot: "slate" | "emerald" | "amber" | "slate2";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left bg-white border rounded-xl px-4 py-3.5 transition-all hover:border-slate-300 ${
        active ? `ring-2 ${FILTER_RING[dot]}` : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${FILTER_DOT[dot]}`} />
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">{label}</span>
        </div>
        {active && <span className="text-[10px] font-semibold text-slate-400">Filtered</span>}
      </div>
      <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight leading-none mt-3">{value.toLocaleString()}</p>
      <p className="text-[11px] text-slate-500 mt-1.5">{sub}</p>
    </button>
  );
}

export default function CampaignDetails({ projectId, actorEmail }: { projectId: string; actorEmail: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [configured, setConfigured] = useState(false);
  const [reason, setReason] = useState<string | undefined>();

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "completed">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/portal/smartlead?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok && res.status !== 503) {
          setError(data.error || "Failed to load campaigns");
        }
        setCampaigns(data.campaigns || []);
        setTotals(data.totals || null);
        setConfigured(!!data.configured);
        setReason(data.reason);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (statusFilter !== "all") {
        const g = statusGroup(c.status);
        if (g !== statusFilter) return false;
      }
      if (!q) return true;
      return (c.name || "").toLowerCase().includes(q) || String(c.campaign_id).includes(q);
    });
  }, [campaigns, statusFilter, search]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-base font-semibold text-slate-800">Campaign Details</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Search campaign…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-3 py-1.5 w-56 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <FilterCard label="Total"     value={counts.total}     sub="All campaigns" dot="slate"   active={statusFilter === "all"}       onClick={() => setStatusFilter("all")} />
        <FilterCard label="Active"    value={counts.active}    sub="Currently sending" dot="emerald" active={statusFilter === "active"}    onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")} />
        <FilterCard label="Paused"    value={counts.paused}    sub="On hold"        dot="amber"   active={statusFilter === "paused"}    onClick={() => setStatusFilter(statusFilter === "paused" ? "all" : "paused")} />
        <FilterCard label="Completed" value={counts.completed} sub="Finished"       dot="slate2"  active={statusFilter === "completed"} onClick={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-14 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin mr-2" /> Loading campaigns…
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-amber-700 bg-amber-50">{error}</div>
        ) : !configured ? (
          <div className="p-6 text-sm text-slate-500 leading-relaxed">
            {reason === "no-key" ? (
              <span>Set <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px] font-mono">SMARTLEAD_API_KEY</code> in <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px] font-mono">.env.local</code> and restart the server to enable campaign visibility.</span>
            ) : reason === "no-name-match" ? (
              <span>No Smartlead campaigns match this client name. Use the &ldquo;Smartlead campaigns&rdquo; card above to attach specific campaign IDs.</span>
            ) : (
              <span>No campaigns linked to this client yet.</span>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            <Inbox size={20} className="mx-auto text-slate-300 mb-2" />
            {search ? "No campaigns match your search." : "No campaigns in this view."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-5 py-2.5">Campaign</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-right px-3 py-2.5">Sent</th>
                  <th className="text-right px-3 py-2.5">Open %</th>
                  <th className="text-right px-3 py-2.5">Reply %</th>
                  <th className="text-right px-3 py-2.5">Bounce %</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const sent = toNum(c.sent_count);
                  const opens = toNum(c.unique_open_count ?? c.open_count);
                  const replies = toNum(c.reply_count);
                  const bounces = toNum(c.bounce_count);
                  const pct = (n: number) => (sent > 0 ? Math.round((n / sent) * 1000) / 10 : 0);
                  const s = (c.status || "").toLowerCase();
                  const statusCls =
                    s === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    s === "paused" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    s === "completed" ? "bg-slate-100 text-slate-600 border-slate-200" :
                    "bg-slate-50 text-slate-500 border-slate-200";
                  const dotCls =
                    s === "active" ? "bg-emerald-500" :
                    s === "paused" ? "bg-amber-500" :
                    s === "completed" ? "bg-slate-500" : "bg-slate-300";
                  return (
                    <tr
                      key={c.campaign_id}
                      onClick={() => setSelectedId(c.campaign_id)}
                      className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <p className="text-sm font-semibold text-slate-900 truncate max-w-[320px]" title={c.name}>{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">#{c.campaign_id}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusCls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                          {c.status || "unknown"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{sent.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{pct(opens)}%</td>
                      <td className="px-3 py-3 text-right tabular-nums">{pct(replies)}%</td>
                      <td className="px-3 py-3 text-right tabular-nums">{pct(bounces)}%</td>
                      <td className="px-3 py-3 text-right">
                        <ChevronRight size={14} className="text-slate-300 inline" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId !== null && (
        <CampaignDrawer
          campaignId={selectedId}
          actorEmail={actorEmail}
          summary={campaigns.find((c) => c.campaign_id === selectedId) || null}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}

function CampaignDrawer({ campaignId, actorEmail, summary, onClose }: {
  campaignId: number;
  actorEmail: string;
  summary: CampaignRow | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<CampaignDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/smartlead/campaign/${campaignId}?actor=${encodeURIComponent(actorEmail)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to load campaign"); return; }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [campaignId, actorEmail]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sent = toNum(summary?.sent_count);
  const opens = toNum(summary?.unique_open_count ?? summary?.open_count);
  const replies = toNum(summary?.reply_count);
  const clicks = toNum(summary?.unique_click_count ?? summary?.click_count);
  const bounces = toNum(summary?.bounce_count);
  const unsubs = toNum(summary?.unsubscribed_count);
  const pct = (n: number) => (sent > 0 ? `${Math.round((n / sent) * 1000) / 10}%` : "—");

  const status = (data?.campaign?.status || summary?.status || "").toLowerCase();
  const statusCls =
    status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    status === "paused" ? "bg-amber-50 text-amber-700 border-amber-200" :
    status === "completed" ? "bg-slate-100 text-slate-600 border-slate-200" :
    "bg-slate-50 text-slate-500 border-slate-200";

  const schedule = data?.schedule;
  const scheduleDays = schedule?.days_of_the_week?.map((d) => DAYS[d] || String(d)).join(", ");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-white shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 truncate">{data?.campaign?.name || summary?.name || `Campaign #${campaignId}`}</h3>
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusCls}`}>
                {data?.campaign?.status || summary?.status || "unknown"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">#{campaignId}{data?.campaign?.created_at ? ` · Created ${new Date(data.campaign.created_at).toLocaleDateString()}` : ""}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading details…
            </div>
          ) : error ? (
            <div className="p-6 m-6 rounded-lg bg-amber-50 text-amber-800 text-sm">{error}</div>
          ) : (
            <div className="p-6 space-y-6">

              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Performance</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <StatTile icon={Send}          label="Sent"     value={sent.toLocaleString()}     sub="" />
                  <StatTile icon={MailOpen}      label="Opens"    value={opens.toLocaleString()}    sub={pct(opens)} />
                  <StatTile icon={Reply}         label="Replies"  value={replies.toLocaleString()}  sub={pct(replies)} accent="violet" />
                  <StatTile icon={MousePointer2} label="Clicks"   value={clicks.toLocaleString()}   sub={pct(clicks)} />
                  <StatTile icon={AlertTriangle} label="Bounces"  value={bounces.toLocaleString()}  sub={pct(bounces)} accent="amber" />
                  <StatTile icon={MailX}         label="Unsubs"   value={unsubs.toLocaleString()}   sub={pct(unsubs)} accent="rose" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Email sequence</p>
                  <p className="text-[11px] text-slate-400">{(data?.sequences || []).length} step{(data?.sequences || []).length === 1 ? "" : "s"}</p>
                </div>
                {(!data?.sequences || data.sequences.length === 0) ? (
                  <div className="text-xs text-slate-400 italic">No sequence steps configured.</div>
                ) : (
                  <div className="space-y-2">
                    {data.sequences.map((s, idx) => {
                      const delay = s.seq_delay_details?.delay_in_days ?? 0;
                      const isOpen = expandedStep === idx;
                      const variants = s.sequence_variants || [];
                      return (
                        <div key={s.id || idx} className="border border-slate-200 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedStep(isOpen ? null : idx)}
                            className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                          >
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#f0e6ff] text-[#6800FF] text-xs font-bold shrink-0">
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
                            <ChevronRight size={14} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-3">
                              {variants.length > 1 ? (
                                variants.map((v, vIdx) => (
                                  <div key={vIdx} className="rounded-md bg-white border border-slate-200 p-3">
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Variant {v.variant_label || String.fromCharCode(65 + vIdx)}</p>
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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Sending accounts</p>
                  <p className="text-[11px] text-slate-400">{(data?.accounts || []).length}</p>
                </div>
                {(!data?.accounts || data.accounts.length === 0) ? (
                  <div className="text-xs text-slate-400 italic">No email accounts attached.</div>
                ) : (
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {data.accounts.map((a, i) => (
                      <li key={a.id || i} className="px-4 py-2.5 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <Mail size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{a.from_name || a.from_email || "Unknown"}</p>
                          <p className="text-[11px] text-slate-500 truncate font-mono">{a.from_email}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-slate-700 tabular-nums">{(a.daily_sent_count ?? 0)} / {(a.message_per_day ?? 0)}</p>
                          <p className="text-[10px] text-slate-400">sent today</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Schedule</p>
                {!schedule ? (
                  <div className="text-xs text-slate-400 italic">Schedule unavailable.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <ScheduleField icon={CalendarClock} label="Timezone"        value={schedule.timezone || "—"} />
                    <ScheduleField icon={CalendarClock} label="Days"            value={scheduleDays || "—"} />
                    <ScheduleField icon={Clock}         label="Sending window"  value={`${schedule.start_hour || "—"} – ${schedule.end_hour || "—"}`} />
                    <ScheduleField icon={Clock}         label="Min gap"         value={schedule.min_time_btw_emails ? `${schedule.min_time_btw_emails} min` : "—"} />
                    <ScheduleField icon={Send}          label="Max new leads/day" value={schedule.max_new_leads_per_day ? String(schedule.max_new_leads_per_day) : "—"} />
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatTile({ icon: Icon, label, value, sub, accent }: { icon: typeof Send; label: string; value: string; sub: string; accent?: "violet" | "amber" | "rose" }) {
  const accentCls =
    accent === "violet" ? "text-[#6800FF]" :
    accent === "amber" ? "text-amber-600" :
    accent === "rose" ? "text-rose-600" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <Icon size={12} className="text-slate-400" />
      </div>
      <p className={`text-lg font-bold tabular-nums mt-1.5 ${accentCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 tabular-nums mt-0.5">{sub}</p>}
    </div>
  );
}

function ScheduleField({ icon: Icon, label, value }: { icon: typeof Send; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-white">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
        <Icon size={12} />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
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
