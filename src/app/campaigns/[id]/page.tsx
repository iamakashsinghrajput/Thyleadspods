"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, ExternalLink, Loader2, Megaphone, Mail, Users, Send, Layers, Settings, RefreshCw } from "lucide-react";

type Analytics = {
  campaign_id: number;
  sent_count: number;
  open_count: number;
  unique_open_count?: number;
  click_count: number;
  unique_click_count?: number;
  reply_count: number;
  bounce_count: number;
  unsubscribed_count: number;
  total_count?: number;
};

type SequenceStep = {
  id?: number;
  seq_number?: number;
  seq_delay_details?: { delay_in_days?: number };
  variant_distribution_type?: string;
  seq_variants?: {
    variant_label?: string;
    subject?: string;
    email_body?: string;
  }[];
  subject?: string;
  email_body?: string;
};

type EmailAccount = {
  id?: number;
  from_name?: string;
  from_email?: string;
  email_warmup_details?: { status?: string };
  warmup_details?: { status?: string };
  daily_sent_count?: number;
  message_per_day?: number;
};

type Campaign = {
  id: number;
  name: string;
  status: string;
  created_at?: string;
  start_date?: string | null;
};

type DetailResponse = {
  campaign: Campaign;
  analytics: Analytics | null;
  sequences: SequenceStep[];
  accounts: EmailAccount[];
  schedule: unknown;
};

type Tab = "analytics" | "leads" | "sequences" | "accounts";

function pct(num: number, denom: number): string {
  if (!denom) return "0%";
  const v = (num / denom) * 100;
  return `${v.toFixed(v >= 10 ? 1 : 2)}%`;
}

function fmtDate(iso?: string | null): string {
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
  const v = (s || "").toLowerCase();
  if (v === "active") return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Active" };
  if (v === "paused") return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Paused" };
  if (v === "stopped") return { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", label: "Stopped" };
  if (v === "completed") return { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500", label: "Completed" };
  return { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", label: s || "Unknown" };
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, hydrated } = useAuth();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("analytics");

  const canAccess = !!user && ["admin", "superadmin"].includes(user.role);

  const fetchDetail = useCallback(async (manual?: boolean) => {
    if (!user?.email) return;
    if (manual) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/smartlead/campaign/${id}?actor=${encodeURIComponent(user.email)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to load campaign"); return; }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.email, id]);

  useEffect(() => { if (canAccess) void fetchDetail(); }, [fetchDetail, canAccess]);

  if (!hydrated) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (!canAccess) {
    return <div className="p-8 text-sm text-slate-600">You don&apos;t have access to this campaign.</div>;
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-400">
        <Loader2 size={14} className="animate-spin mr-2" /> Loading campaign…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6">
        <Link href="/campaigns" className="text-xs text-slate-500 hover:text-[#6800FF] flex items-center gap-1">
          <ArrowLeft size={12} /> Back to campaigns
        </Link>
        <div className="mt-4 p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">{error || "Campaign not found"}</div>
      </div>
    );
  }

  const c = data.campaign;
  const a = data.analytics;
  const st = statusStyle(c.status);
  const totalLeads = a?.total_count || 0;
  const sent = a?.sent_count || 0;
  const opened = a?.open_count || 0;
  const clicked = a?.click_count || 0;
  const replied = a?.reply_count || 0;
  const bounced = a?.bounce_count || 0;
  const unsubscribed = a?.unsubscribed_count || 0;
  const uniqueOpens = a?.unique_open_count || 0;
  const uniqueClicks = a?.unique_click_count || 0;

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="bg-white border-b border-slate-200">
        <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Link href="/campaigns" className="mt-1 p-1 text-slate-400 hover:text-[#6800FF] rounded">
              <ArrowLeft size={16} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 truncate">{c.name}</h1>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${st.bg} ${st.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
                <a
                  href={`https://app.smartlead.ai/app/email-campaign/${c.id}/analytics`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in Smartlead"
                  className="text-slate-400 hover:text-[#6800FF]"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{fmtDate(c.created_at)}</p>
            </div>
          </div>
          <button
            onClick={() => fetchDetail(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="px-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-100 -mb-px border-t border-slate-100">
          <Stat icon={<Layers size={11} />} label="Sequences" value={String(data.sequences?.length || 0)} />
          <Stat icon={<Mail size={11} />} label="Email Accounts" value={String(data.accounts?.length || 0)} />
          <Stat icon={<Users size={11} />} label="Total Leads" value={totalLeads.toLocaleString()} />
          <Stat icon={<Send size={11} />} label="Sent" value={sent.toLocaleString()} />
          <Stat icon={<Megaphone size={11} />} label="Reply Rate" value={pct(replied, sent)} />
          <Stat icon={<Settings size={11} />} label="Bounce Rate" value={pct(bounced, sent)} accent={bounced > 0 ? "rose" : undefined} />
        </div>

        <div className="px-6 flex items-center gap-5 border-t border-slate-200">
          {(["analytics", "sequences", "accounts"] as Tab[]).map((t) => {
            const active = tab === t;
            const labels: Record<Tab, string> = {
              analytics: "Analytics",
              leads: "Leads",
              sequences: `Sequences (${data.sequences?.length || 0})`,
              accounts: `Email Accounts (${data.accounts?.length || 0})`,
            };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-2.5 -mb-px text-[12.5px] font-semibold transition-colors border-b-2 ${
                  active ? "text-[#6800FF] border-[#6800FF]" : "text-slate-500 hover:text-slate-700 border-transparent"
                }`}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-5">
        {tab === "analytics" && (
          <div className="space-y-5">
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Engagement</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard label="Total Leads Contacted" value={sent.toLocaleString()} sub={`${totalLeads.toLocaleString()} total`} />
                <MetricCard label="Opens" value={opened.toLocaleString()} sub={`${pct(opened, sent)} open rate · ${uniqueOpens} unique`} accent="violet" />
                <MetricCard label="Clicks" value={clicked.toLocaleString()} sub={`${pct(clicked, sent)} click rate · ${uniqueClicks} unique`} accent="amber" />
                <MetricCard label="Replies" value={replied.toLocaleString()} sub={`${pct(replied, sent)} reply rate`} accent="emerald" />
              </div>
            </section>

            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Deliverability</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <MetricCard label="Bounced" value={bounced.toLocaleString()} sub={`${pct(bounced, sent)} bounce rate`} accent={bounced > 0 ? "rose" : undefined} />
                <MetricCard label="Unsubscribed" value={unsubscribed.toLocaleString()} sub={`${pct(unsubscribed, sent)} unsub rate`} accent="slate" />
                <MetricCard label="Net Deliverable" value={(sent - bounced).toLocaleString()} sub={`${pct(sent - bounced, sent)} delivered`} accent="emerald" />
              </div>
            </section>
          </div>
        )}

        {tab === "sequences" && (
          <div className="space-y-3">
            {(data.sequences || []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No sequences configured.</p>
            ) : (
              (data.sequences || []).map((s, idx) => {
                const variants = s.seq_variants && s.seq_variants.length > 0 ? s.seq_variants : [{ subject: s.subject, email_body: s.email_body, variant_label: "" }];
                const delay = s.seq_delay_details?.delay_in_days ?? 0;
                return (
                  <div key={s.id ?? idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#f0e6ff] text-[#6800FF] text-xs font-bold">
                        {s.seq_number ?? idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-slate-900">Step {s.seq_number ?? idx + 1}</p>
                        <p className="text-[11px] text-slate-500">
                          {idx === 0 ? "Sent immediately" : `Delayed ${delay} day${delay === 1 ? "" : "s"} after previous step`}
                          {variants.length > 1 && ` · ${variants.length} variants`}
                        </p>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {variants.map((v, vi) => (
                        <div key={vi} className="px-5 py-4 space-y-1.5">
                          {variants.length > 1 && v.variant_label && (
                            <span className="inline-block text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Variant {v.variant_label}</span>
                          )}
                          {v.subject && (
                            <p className="text-[13px] font-semibold text-slate-800">
                              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide mr-1.5">Subject:</span>
                              {v.subject}
                            </p>
                          )}
                          {v.email_body && (
                            <div
                              className="prose prose-sm max-w-none text-[12.5px] leading-[1.6] text-slate-700 [&_a]:text-[#6800FF] [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 mt-1"
                              dangerouslySetInnerHTML={{ __html: v.email_body }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "accounts" && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="text-left px-4 py-3">From</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-right px-4 py-3">Daily Sent</th>
                  <th className="text-right px-4 py-3">Daily Limit</th>
                  <th className="text-left px-4 py-3">Warmup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.accounts || []).length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-sm text-slate-400">No email accounts configured.</td></tr>
                ) : (
                  (data.accounts || []).map((acc) => {
                    const warmup = acc.email_warmup_details?.status || acc.warmup_details?.status || "—";
                    return (
                      <tr key={acc.id || acc.from_email} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-[13px] font-medium text-slate-800">{acc.from_name || "—"}</td>
                        <td className="px-4 py-3 text-[12.5px] text-slate-600">{acc.from_email || "—"}</td>
                        <td className="px-4 py-3 text-right text-[13px] font-semibold text-slate-900 tabular-nums">{acc.daily_sent_count ?? 0}</td>
                        <td className="px-4 py-3 text-right text-[13px] text-slate-600 tabular-nums">{acc.message_per_day ?? "—"}</td>
                        <td className="px-4 py-3 text-[11px] font-semibold text-slate-600">{warmup}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "rose" }) {
  return (
    <div className="bg-white px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <p className={`text-[15px] font-bold tabular-nums mt-0.5 ${accent === "rose" ? "text-rose-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "violet" | "amber" | "emerald" | "rose" | "slate" }) {
  const colors: Record<NonNullable<typeof accent>, string> = {
    violet: "text-violet-700",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    slate: "text-slate-700",
  };
  const valueClass = accent ? colors[accent] : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-[24px] font-bold tabular-nums mt-1 leading-none ${valueClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1.5">{sub}</p>}
    </div>
  );
}
