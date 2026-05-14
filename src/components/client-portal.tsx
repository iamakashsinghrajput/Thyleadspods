"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { LogOut, Calendar, CheckCircle2, MessageSquare, X, Mail, Phone, User, Users, Building2, Globe, Video, Loader2, Search, Send, Reply, AlertTriangle, MailX, ChevronRight, ChevronDown, Sparkles, Lock, KeyRound, LayoutDashboard, Megaphone } from "lucide-react";
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
  const [pwOpen, setPwOpen] = useState(false);
  const [remarks, setRemarks] = useState<Record<string, RemarkData>>({});
  const [, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClientDetail | null>(null);
  const [editingRemark, setEditingRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);

  const projectId = user?.projectId || "";
  const meetings: ClientDetail[] = details[projectId] ?? [];

  type SmartleadCampaignRow = {
    campaign_id: number;
    name: string;
    status: string;
    created_at?: string;
    total_count?: number;
    sent_count?: number;
    reply_count?: number;
    unique_reply_count?: number;
    positive_reply_count?: number;
    bounce_count?: number;
    unsubscribed_count?: number;
  };
  type SmartleadTotals = {
    sent: number; replies: number; uniqueReplies: number; positiveReplies: number; bounces: number; unsubscribes: number;
    replyRate: number; uniqueReplyRate: number; positiveReplyRate: number; bounceRate: number; unsubscribeRate: number;
  };
  const [smartlead, setSmartlead] = useState<{ campaigns: SmartleadCampaignRow[]; totals: SmartleadTotals; configured: boolean; reason?: string } | null>(null);
  const [smartleadLoading, setSmartleadLoading] = useState(true);
  const [smartleadError, setSmartleadError] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "campaigns" | "accounts">("dashboard");

  type AccountGroup = {
    rootKey: string;
    displayDomain: string;
    company: string;
    domains: { domain: string; company: string }[];
  };
  const [accounts, setAccounts] = useState<{ groups: AccountGroup[]; total: number; updatedAt: string | null } | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState("");

  useEffect(() => {
    if (!projectId) { setAccountsLoading(false); return; }
    let cancelled = false;
    (async () => {
      setAccountsLoading(true);
      setAccountsError("");
      try {
        const res = await fetch(`/api/portal/accounts?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { setAccountsError(json.error || "Failed to load accounts"); setAccountsLoading(false); return; }
        setAccounts(json);
      } catch (e) {
        if (!cancelled) setAccountsError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

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
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const upcomingMeetings = meetings
    .filter((m) => m.meetingStatus === "scheduled" && m.meetingDate && m.meetingDate >= todayStr)
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate) || (a.meetingTime || "").localeCompare(b.meetingTime || ""));

  const navItems = [
    { key: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard, count: meetings.length },
    { key: "campaigns" as const, label: "Campaigns", icon: Megaphone, count: smartlead?.campaigns.length || 0 },
    { key: "accounts" as const, label: "Accounts", icon: Building2, count: accounts?.total || 0 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex">
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <ClientLogo name={user.name} size={36} />
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-slate-900 leading-tight truncate">{user.name}</p>
            <p className="text-[10px] font-medium text-slate-500 leading-tight mt-0.5">by Thyleads</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors ${
                  active ? "bg-[#6800FF] text-white font-semibold shadow-sm" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon size={15} />
                  {item.label}
                </span>
                <span className={`text-[10px] tabular-nums rounded px-1.5 py-0.5 ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{item.count}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-3 space-y-1 border-t border-slate-100 pt-3">
          <button
            onClick={() => setPwOpen(true)}
            className="w-full inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-[#6800FF] hover:bg-[#f0e6ff] rounded-lg transition-colors"
          >
            <KeyRound size={13} /> Change password
          </button>
          <button onClick={logout} className="w-full inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 w-full px-6 lg:px-10 py-6">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {activeTab === "campaigns" ? "Campaigns" : activeTab === "accounts" ? "Accounts" : "Dashboard"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === "campaigns"
                ? "Live performance across your outbound campaigns"
                : activeTab === "accounts"
                  ? `${accounts?.total || 0} target accounts in your TAL`
                  : `${meetings.length} meetings on your portal`}
            </p>
          </div>
        </div>


        {activeTab === "campaigns" && (
          <CampaignsSection smartlead={smartlead} loading={smartleadLoading} error={smartleadError} projectId={projectId} />
        )}

        {activeTab === "dashboard" && (
          <DashboardView
            meetings={meetings}
            upcomingMeetings={upcomingMeetings}
            onOpen={openMeeting}
          />
        )}

        {activeTab === "accounts" && (
          <AccountsSection
            groups={accounts?.groups || []}
            loading={accountsLoading}
            error={accountsError}
          />
        )}
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

      {pwOpen && <ChangePasswordModal email={user.email} onClose={() => setPwOpen(false)} />}
    </div>
  );
}

function ChangePasswordModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  async function submit() {
    setErr("");
    if (!current || !next) { setErr("Fill in both fields."); return; }
    if (next.length < 6) { setErr("New password must be at least 6 characters."); return; }
    if (next !== confirmPw) { setErr("New passwords don't match."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Failed to change password"); return; }
      setOk(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="bg-linear-to-br from-[#6800FF] to-[#9b00ff] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={16} />
            <h2 className="text-sm font-bold">Change password</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {ok ? (
            <div className="flex items-center gap-2 text-emerald-700 py-3">
              <CheckCircle2 size={16} />
              <p className="text-sm font-semibold">Password updated.</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-slate-500">For your security, please enter your current password before choosing a new one.</p>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Current password</label>
                <input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoFocus
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">New password (min 6 chars)</label>
                <input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15"
                />
              </div>
              {err && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 inline-flex items-start gap-1.5">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {err}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg">
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={busy || !current || !next || next !== confirmPw}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 rounded-lg"
                >
                  {busy ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : <>Update password</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type CampaignsSectionProps = {
  projectId: string;
  smartlead: {
    campaigns: Array<{
      campaign_id: number;
      name: string;
      status: string;
      created_at?: string;
      total_count?: number;
      sent_count?: number;
      reply_count?: number;
      unique_reply_count?: number;
      positive_reply_count?: number;
      bounce_count?: number;
      unsubscribed_count?: number;
    }>;
    totals: {
      sent: number; replies: number; uniqueReplies: number; positiveReplies: number; bounces: number; unsubscribes: number;
      replyRate: number; uniqueReplyRate: number; positiveReplyRate: number; bounceRate: number; unsubscribeRate: number;
    };
    configured: boolean;
    reason?: string;
  } | null;
  loading: boolean;
  error: string;
};


type CampaignDetail = {
  campaign: { id: number; name: string; status: string; created_at?: string; start_date?: string | null };
  analytics: { sent_count?: number; open_count?: number; unique_open_count?: number; click_count?: number; unique_click_count?: number; reply_count?: number; bounce_count?: number; unsubscribed_count?: number; total_count?: number } | null;
  sequences: Array<{
    id?: number;
    seq_number?: number;
    seq_delay_details?: { delay_in_days?: number };
    seq_variants?: Array<{ variant_label?: string; subject?: string; email_body?: string }>;
    subject?: string;
    email_body?: string;
  }>;
  accounts: Array<{
    id?: number;
    from_name?: string;
    from_email?: string;
    daily_sent_count?: number;
    message_per_day?: number;
  }>;
};

type DetailEntry = { loading?: boolean; data?: CampaignDetail; error?: string };

function CampaignsSection({ smartlead, loading, error, projectId }: CampaignsSectionProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailById, setDetailById] = useState<Record<number, DetailEntry>>({});
  const [statusTab, setStatusTab] = useState<"all" | "active" | "paused" | "completed" | "stopped">("all");
  const [search, setSearch] = useState<string>("");

  async function openCampaign(campaignId: number) {
    setSelectedId(campaignId);
    if (detailById[campaignId]?.data || detailById[campaignId]?.loading) return;
    setDetailById((prev) => ({ ...prev, [campaignId]: { loading: true } }));
    try {
      const res = await fetch(`/api/portal/campaign/${campaignId}?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setDetailById((prev) => ({ ...prev, [campaignId]: { error: json.error || "Failed to load" } }));
        return;
      }
      setDetailById((prev) => ({ ...prev, [campaignId]: { data: json } }));
    } catch (e) {
      setDetailById((prev) => ({ ...prev, [campaignId]: { error: e instanceof Error ? e.message : "Network error" } }));
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={14} className="animate-spin" /> Loading campaign metrics…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
        Couldn&apos;t load campaigns: {error}
      </div>
    );
  }
  if (!smartlead || !smartlead.configured) {
    const reason = smartlead?.reason;
    const isKeyMissing = reason === "no-key";
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">Outbound campaigns</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {reason === "no-name-match"
              ? "No Smartlead campaigns matched this account's name yet."
              : "Live Smartlead performance metrics"}
          </p>
        </div>
        <div className="p-6 text-sm leading-relaxed space-y-2 text-slate-600">
          {isKeyMissing ? (
            <p>Smartlead isn&apos;t connected on the server yet.</p>
          ) : reason === "no-name-match" ? (
            <p>Your Thyleads admin can attach specific campaigns to this account.</p>
          ) : (
            <p>No campaigns are showing up for this account yet.</p>
          )}
        </div>
      </div>
    );
  }
  if (smartlead.campaigns.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-6 py-8 text-sm text-slate-500 text-center">
        No campaigns returned for this account.
      </div>
    );
  }

  const { campaigns } = smartlead;

  if (selectedId != null) {
    const c = campaigns.find((x) => x.campaign_id === selectedId);
    const detail = detailById[selectedId];
    return (
      <CampaignDetailFullView
        campaignSummary={c ?? null}
        detail={detail}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const counts = {
    all: campaigns.length,
    active: campaigns.filter((c) => (c.status || "").toLowerCase() === "active").length,
    paused: campaigns.filter((c) => (c.status || "").toLowerCase() === "paused").length,
    completed: campaigns.filter((c) => (c.status || "").toLowerCase() === "completed").length,
    stopped: campaigns.filter((c) => (c.status || "").toLowerCase() === "stopped").length,
  };

  const filtered = campaigns.filter((c) => {
    if (statusTab !== "all" && (c.status || "").toLowerCase() !== statusTab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const tabs: { key: typeof statusTab; label: string; count: number }[] = [
    { key: "all",       label: "ALL CAMPAIGNS", count: counts.all },
    { key: "active",    label: "ACTIVE",        count: counts.active },
    { key: "paused",    label: "PAUSED",        count: counts.paused },
    { key: "stopped",   label: "STOPPED",       count: counts.stopped },
    { key: "completed", label: "COMPLETED",     count: counts.completed },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 pt-3 flex items-center justify-between gap-4 flex-wrap border-b border-slate-200">
        <div className="flex items-center gap-5 -mb-px">
          {tabs.map((t) => {
            const active = statusTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setStatusTab(t.key)}
                className={`pb-2.5 text-[11.5px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                  active ? "text-[#6800FF] border-[#6800FF]" : "text-slate-500 hover:text-slate-700 border-transparent"
                }`}
              >
                {t.label} <span className={active ? "text-[#6800FF]" : "text-slate-400"}>({t.count})</span>
              </button>
            );
          })}
        </div>
        <div className="relative pb-2">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaign"
            className="w-56 pl-7 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="bg-slate-50/60 border-b border-slate-200 text-left px-5 py-2.5">Campaign</th>
              <ColHeader icon={<Users size={11} />} label="Leads" />
              <ColHeader icon={<Send size={11} />} label="Sent" />
              <ColHeader icon={<Sparkles size={11} />} label="Positive Reply" />
              <ColHeader icon={<Reply size={11} />} label="Reply" />
              <ColHeader icon={<Mail size={11} />} label="Unique Reply" />
              <ColHeader icon={<AlertTriangle size={11} />} label="Bounce" />
              <ColHeader icon={<MailX size={11} />} label="Unsub" last />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">
                  No campaigns match your search.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const toNum = (v: unknown) => {
                  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
                  if (typeof v === "string") { const p = Number(v); return Number.isFinite(p) ? p : 0; }
                  return 0;
                };
                const sent = toNum(c.sent_count);
                const total = toNum(c.total_count);
                const leads = total || sent;
                const replies = toNum(c.reply_count);
                const uniqueReplies = toNum(c.unique_reply_count);
                const positiveReplies = toNum(c.positive_reply_count);
                const bounces = toNum(c.bounce_count);
                const unsubs = toNum(c.unsubscribed_count);
                const progressPct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
                const status = (c.status || "").toLowerCase();
                const statusBadge =
                  status === "active" ? "text-emerald-700" :
                  status === "paused" ? "text-amber-700" :
                  status === "completed" ? "text-slate-600" :
                  status === "stopped" ? "text-rose-700" :
                  "text-slate-500";
                const statusDot =
                  status === "active" ? "bg-emerald-500" :
                  status === "paused" ? "bg-amber-500" :
                  status === "completed" ? "bg-slate-500" :
                  status === "stopped" ? "bg-rose-500" :
                  "bg-slate-300";
                return (
                  <tr
                    key={c.campaign_id}
                    onClick={() => openCampaign(c.campaign_id)}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                  >
                    <td className="border-b border-slate-100 px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <ProgressRing pct={progressPct} accent={status} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13.5px] font-semibold text-slate-900 truncate max-w-[280px]" title={c.name}>{c.name}</p>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${statusBadge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                              {status ? status[0].toUpperCase() + status.slice(1) : "Unknown"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{formatCampaignCreated(c.created_at)}</p>
                        </div>
                      </div>
                    </td>
                    <CountCell num={leads} />
                    <CountCell num={sent} />
                    <RateCell num={positiveReplies} den={sent} color="emerald" />
                    <RateCell num={replies} den={sent} color="violet" />
                    <RateCell num={uniqueReplies} den={sent} color="sky" />
                    <RateCell num={bounces} den={sent} color="amber" />
                    <RateCell num={unsubs} den={sent} color="rose" lastCol />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pctStr(num: number, den: number): string {
  if (!den) return "0%";
  const v = (num / den) * 100;
  return `${v.toFixed(v >= 10 ? 1 : 2)}%`;
}

function CampaignDetailFullView({
  campaignSummary,
  detail,
  onBack,
}: {
  campaignSummary: { campaign_id: number; name: string; status: string } | null;
  detail: DetailEntry | undefined;
  onBack: () => void;
}) {
  if (!detail || detail.loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <DetailHeader name={campaignSummary?.name || "Campaign"} status={campaignSummary?.status} onBack={onBack} />
        <div className="flex items-center justify-center py-20 text-sm text-slate-400">
          <Loader2 size={14} className="animate-spin mr-2" /> Loading campaign report…
        </div>
      </div>
    );
  }
  if (detail.error) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <DetailHeader name={campaignSummary?.name || "Campaign"} status={campaignSummary?.status} onBack={onBack} />
        <div className="p-6 text-sm text-rose-700">Could not load details: {detail.error}</div>
      </div>
    );
  }
  if (!detail.data) return null;

  const { campaign, analytics, sequences, accounts } = detail.data;
  const sent = analytics?.sent_count || 0;
  const replies = analytics?.reply_count || 0;
  const bounces = analytics?.bounce_count || 0;
  const unsubs = analytics?.unsubscribed_count || 0;
  const total = analytics?.total_count || 0;

  return (
    <div className="space-y-5 mb-5">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <DetailHeader name={campaign.name} status={campaign.status} onBack={onBack} />

        <div className="px-6 py-5 space-y-6">
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Engagement</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DetailMetric label="Total Leads" value={total.toLocaleString()} sub={`${sent.toLocaleString()} sent`} />
              <DetailMetric label="Positive Replies" value={"—"} sub="See the table for live rate" accent="emerald" />
              <DetailMetric label="Total Replies" value={replies.toLocaleString()} sub={`${pctStr(replies, sent)} rate`} accent="violet" />
              <DetailMetric label="Net Deliverable" value={(sent - bounces).toLocaleString()} sub={`${pctStr(sent - bounces, sent)} delivered`} />
            </div>
          </section>

          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Deliverability</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <DetailMetric label="Bounced" value={bounces.toLocaleString()} sub={`${pctStr(bounces, sent)} bounce rate`} accent={bounces > 0 ? "rose" : undefined} />
              <DetailMetric label="Unsubscribed" value={unsubs.toLocaleString()} sub={`${pctStr(unsubs, sent)} unsub rate`} />
              <DetailMetric label="Sent" value={sent.toLocaleString()} sub={`${total ? Math.round((sent / total) * 100) : 0}% of total leads`} />
            </div>
          </section>

          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Sequence ({sequences.length} {sequences.length === 1 ? "step" : "steps"})</p>
            {sequences.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No sequence steps configured.</p>
            ) : (
              <div className="space-y-2">
                {sequences.map((s, idx) => {
                  const variants = s.seq_variants && s.seq_variants.length > 0
                    ? s.seq_variants
                    : [{ subject: s.subject, email_body: s.email_body, variant_label: "" }];
                  const delay = s.seq_delay_details?.delay_in_days ?? 0;
                  return (
                    <div key={s.id ?? idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#f0e6ff] text-[#6800FF] text-[11px] font-bold">
                          {s.seq_number ?? idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold text-slate-900">Step {s.seq_number ?? idx + 1}</p>
                          <p className="text-[10.5px] text-slate-500">
                            {idx === 0 ? "Sent immediately" : `Delayed ${delay} day${delay === 1 ? "" : "s"} after previous step`}
                            {variants.length > 1 && ` · ${variants.length} variants`}
                          </p>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {variants.map((v, vi) => (
                          <div key={vi} className="px-4 py-3 space-y-1.5">
                            {variants.length > 1 && v.variant_label && (
                              <span className="inline-block text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Variant {v.variant_label}</span>
                            )}
                            {v.subject && (
                              <p className="text-[12.5px] font-semibold text-slate-800">
                                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide mr-1.5">Subject:</span>
                                {v.subject}
                              </p>
                            )}
                            {v.email_body && (
                              <div
                                className="prose prose-sm max-w-none text-[12px] leading-[1.6] text-slate-700 [&_a]:text-[#6800FF] [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ __html: v.email_body }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Email accounts ({accounts.length})</p>
            {accounts.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No email accounts configured.</p>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-2">From</th>
                      <th className="text-left px-4 py-2">Email</th>
                      <th className="text-right px-4 py-2">Daily Sent</th>
                      <th className="text-right px-4 py-2">Daily Limit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accounts.map((acc) => (
                      <tr key={acc.id || acc.from_email} className="text-[12.5px]">
                        <td className="px-4 py-2 font-medium text-slate-800">{acc.from_name || "—"}</td>
                        <td className="px-4 py-2 text-slate-600">{acc.from_email || "—"}</td>
                        <td className="px-4 py-2 text-right text-slate-900 tabular-nums">{acc.daily_sent_count ?? 0}</td>
                        <td className="px-4 py-2 text-right text-slate-600 tabular-nums">{acc.message_per_day ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailHeader({ name, status, onBack }: { name: string; status?: string; onBack: () => void }) {
  const s = (status || "").toLowerCase();
  const statusColor =
    s === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    s === "paused" ? "bg-amber-50 text-amber-700 border-amber-200" :
    s === "completed" ? "bg-slate-100 text-slate-600 border-slate-200" :
    "bg-slate-50 text-slate-500 border-slate-200";
  const dotColor =
    s === "active" ? "bg-emerald-500" :
    s === "paused" ? "bg-amber-500" :
    s === "completed" ? "bg-slate-500" :
    "bg-slate-300";
  return (
    <header className="px-6 py-4 border-b border-slate-200 flex items-center gap-3 flex-wrap">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-[#6800FF] bg-slate-50 hover:bg-[#f0e6ff] border border-slate-200 hover:border-[#6800FF]/30 rounded-lg transition-colors"
      >
        <ChevronRight size={13} className="rotate-180" /> Back to campaigns
      </button>
      <h2 className="text-base font-bold text-slate-900 min-w-0 truncate">{name}</h2>
      {status && (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          {status}
        </span>
      )}
    </header>
  );
}

function DashboardView({
  meetings,
  upcomingMeetings,
  onOpen,
}: {
  meetings: ClientDetail[];
  upcomingMeetings: ClientDetail[];
  onOpen: (m: ClientDetail) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "done" | "pipeline" | "thisMonth">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const now = new Date();
  const currentMonth = now.toLocaleDateString("en-US", { month: "long" });
  const currentYear = now.getFullYear();
  const thisMonthCount = meetings.filter((m) => m.month === currentMonth && m.year === currentYear).length;
  const doneCount = meetings.filter((m) => m.meetingStatus === "done").length;
  const scheduledCount = meetings.filter((m) => m.meetingStatus === "scheduled").length;
  const pipelineCount = meetings.filter((m) => m.meetingStatus === "pipeline").length;

  const upcoming = upcomingMeetings.slice(0, 5);

  const todayStr = new Date().toISOString().slice(0, 10);
  const recent = [...meetings]
    .filter((m) => m.meetingDate && m.meetingDate <= todayStr)
    .sort((a, b) => (b.meetingDate || "").localeCompare(a.meetingDate || ""))
    .slice(0, 5);

  const monthOptions = Array.from(new Set(meetings
    .filter((m) => m.month && m.year)
    .map((m) => `${m.month} ${m.year}`)
  )).sort((a, b) => {
    const order = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const [am, ay] = a.split(" ");
    const [bm, by] = b.split(" ");
    return Number(by) - Number(ay) || order.indexOf(bm) - order.indexOf(am);
  });

  const allFiltered = meetings.filter((m) => {
    if (statusFilter === "thisMonth") {
      if (m.month !== currentMonth || m.year !== currentYear) return false;
    } else if (statusFilter !== "all" && m.meetingStatus !== statusFilter) {
      return false;
    }
    if (monthFilter !== "all" && `${m.month} ${m.year}` !== monthFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(m.companyName.toLowerCase().includes(q)
        || m.contactName.toLowerCase().includes(q)
        || (m.meetingId || "").toLowerCase().includes(q)
        || (m.contactEmail || "").toLowerCase().includes(q))) return false;
    }
    return true;
  }).sort((a, b) => {
    const dateCmp = (b.meetingDate || "").localeCompare(a.meetingDate || "");
    if (dateCmp !== 0) return dateCmp;
    return (b.meetingTime || "").localeCompare(a.meetingTime || "");
  });

  const filtersAreActive = statusFilter !== "all" || monthFilter !== "all" || search.trim() !== "";

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatTile label="This Month" value={thisMonthCount} sub={`${currentMonth} ${currentYear}`}
          active={statusFilter === "thisMonth"} onClick={() => setStatusFilter((p) => p === "thisMonth" ? "all" : "thisMonth")} />
        <StatTile label="Completed" value={doneCount} sub="All time" accent="emerald"
          active={statusFilter === "done"} onClick={() => setStatusFilter((p) => p === "done" ? "all" : "done")} />
        <StatTile label="Scheduled" value={scheduledCount} sub="Upcoming" accent="amber"
          active={statusFilter === "scheduled"} onClick={() => setStatusFilter((p) => p === "scheduled" ? "all" : "scheduled")} />
        <StatTile label="Pipeline" value={pipelineCount} sub="In progress" accent="indigo"
          active={statusFilter === "pipeline"} onClick={() => setStatusFilter((p) => p === "pipeline" ? "all" : "pipeline")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section>
          <h2 className="text-base font-bold text-slate-900 mb-3">Recent Activity</h2>
          {recent.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500">
              No recent meeting activity yet.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <ul className="divide-y divide-slate-100">
                {recent.map((m) => (
                  <li key={m.meetingId}>
                    <button
                      onClick={() => onOpen(m)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50/60 transition-colors flex items-center gap-3"
                    >
                      <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                        m.meetingStatus === "done" ? "bg-emerald-50 text-emerald-600" :
                        m.meetingStatus === "scheduled" ? "bg-amber-50 text-amber-600" :
                        "bg-indigo-50 text-indigo-600"
                      }`}>
                        {m.meetingStatus === "done" ? <CheckCircle2 size={14} /> : <Calendar size={14} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">
                          <span className="text-slate-500 font-normal">Meeting with </span>{m.companyName || "—"}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {m.contactName || "—"}
                          {m.contactTitle && <span className="text-slate-400"> · {m.contactTitle}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-semibold text-slate-600 tabular-nums">{m.meetingDate || "—"}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{m.meetingStatus}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-base font-bold text-slate-900 mb-3">Upcoming Meetings</h2>
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500 flex items-center gap-3">
              <Calendar size={16} className="text-slate-400" />
              No upcoming meetings scheduled.
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((m) => (
                <MeetingCard key={m.meetingId} m={m} onClick={() => onOpen(m)} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-base font-bold text-slate-900">All Meetings</h2>
          <span className="text-[11px] text-slate-400 tabular-nums">{allFiltered.length.toLocaleString()} shown</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-3 flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF]"
          >
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="done">Completed</option>
            <option value="pipeline">Pipeline</option>
            <option value="thisMonth">This month</option>
          </select>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF]"
          >
            <option value="all">All months</option>
            {monthOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, contact, email…"
            className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF]"
          />
          {filtersAreActive && (
            <button
              onClick={() => { setStatusFilter("all"); setMonthFilter("all"); setSearch(""); }}
              className="text-[11px] font-semibold text-slate-500 hover:text-rose-600"
            >
              Clear
            </button>
          )}
        </div>

        {allFiltered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 text-center">
            No meetings match these filters.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full text-[12.5px] border-separate border-spacing-0">
                <thead className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    {[
                      { l: "#", align: "right", w: "w-12" },
                      { l: "Month" },
                      { l: "Meeting Date" },
                      { l: "Meeting Time" },
                      { l: "Company Name" },
                      { l: "Geo" },
                      { l: "Thyleads Rep" },
                      { l: "Account Manager" },
                      { l: "Status" },
                      { l: "Meeting Link" },
                      { l: "Contact Name" },
                      { l: "Contact Title" },
                      { l: "Contact Email" },
                      { l: "Contact Number" },
                    ].map((c) => (
                      <th
                        key={c.l}
                        className={`sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-3 py-2 whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"} ${c.w || ""}`}
                      >
                        {c.l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allFiltered.map((m, idx) => {
                    const style = statusStyle[m.meetingStatus] || statusStyle.pipeline;
                    return (
                      <tr
                        key={m.meetingId}
                        onClick={() => onOpen(m)}
                        className="hover:bg-slate-50/60 cursor-pointer"
                      >
                        <td className="border-b border-slate-100 px-3 py-2 text-right text-[11px] font-semibold text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap text-slate-700">{m.month || "—"}</td>
                        <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap font-semibold text-slate-900">{m.meetingDate || "—"}</td>
                        <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap text-slate-700 tabular-nums">{m.meetingTime || "—"}</td>
                        <td className="border-b border-slate-100 px-3 py-2 text-slate-800 font-medium truncate max-w-[200px]" title={m.companyName}>{m.companyName || "—"}</td>
                        <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap text-slate-700">{m.geo || "—"}</td>
                        <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap text-slate-700 truncate max-w-[140px]">{m.salesRep || "—"}</td>
                        <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap text-slate-700 truncate max-w-[140px]">{m.accountManager || "—"}</td>
                        <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>{style.label}</span>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap">
                          {m.meetingLink ? (
                            <a
                              href={m.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[#6800FF] hover:underline"
                            >
                              <Video size={11} /> Join
                            </a>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 truncate max-w-[180px]">
                          <span className="text-slate-800">{m.contactName || "—"}</span>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-slate-700 truncate max-w-[160px]">{m.contactTitle || "—"}</td>
                        <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap">
                          {m.contactEmail ? (
                            <a href={`mailto:${m.contactEmail}`} onClick={(e) => e.stopPropagation()} className="text-[#6800FF] hover:underline">{m.contactEmail}</a>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 whitespace-nowrap text-slate-700 tabular-nums">{m.contactNumber || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function MeetingCard({ m, onClick }: { m: ClientDetail; onClick: () => void }) {
  const style = statusStyle[m.meetingStatus] || statusStyle.pipeline;
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 hover:border-[#6800FF]/40 hover:shadow-sm rounded-xl px-4 py-3 transition-all"
    >
      <p className="text-[13.5px] font-semibold text-slate-900 truncate">{m.companyName || "—"}</p>
      <p className="text-[11px] text-slate-500 mt-1 truncate">
        {m.contactName || "—"}
        {m.contactTitle && <span className="text-slate-400"> · {m.contactTitle}</span>}
      </p>
      <div className="flex items-center gap-2 mt-2 text-[11px]">
        <span className="text-slate-600 tabular-nums">{m.meetingDate || "—"}</span>
        {m.meetingTime && <span className="text-slate-400">· {m.meetingTime}</span>}
        <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ml-auto ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>
    </button>
  );
}



function ColHeader({ icon, label, last }: { icon: React.ReactNode; label: string; last?: boolean }) {
  return (
    <th className={`bg-slate-50/60 border-b border-slate-200 text-right py-2.5 ${last ? "px-5" : "px-3"}`}>
      <span className="inline-flex items-center gap-1 justify-end text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </span>
    </th>
  );
}

function CountCell({ num }: { num: number }) {
  return (
    <td className="border-b border-slate-100 px-3 py-3 text-right">
      <p className={`text-sm font-semibold tabular-nums ${num > 0 ? "text-slate-900" : "text-slate-400"}`}>{num.toLocaleString()}</p>
    </td>
  );
}

function RateCell({ num, den, color, lastCol }: { num: number; den: number; color: "emerald" | "violet" | "sky" | "amber" | "rose"; lastCol?: boolean }) {
  const pct = den > 0 ? (num / den) * 100 : 0;
  const pctLabel = den > 0 ? `${Math.round(pct * 10) / 10}%` : "0%";
  const numClass = num > 0 ? {
    emerald: "text-emerald-700",
    violet: "text-[#6800FF]",
    sky: "text-sky-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  }[color] : "text-slate-400";
  return (
    <td className={`border-b border-slate-100 py-3 text-right tabular-nums ${lastCol ? "px-5" : "px-3"}`}>
      <p className={`text-sm font-semibold ${numClass}`}>{num.toLocaleString()}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{pctLabel}</p>
    </td>
  );
}

function ProgressRing({ pct, accent }: { pct: number; accent: string }) {
  const size = 36;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  const ringColor =
    accent === "active" ? "#10b981" :
    accent === "paused" ? "#f59e0b" :
    accent === "completed" ? "#64748b" :
    accent === "stopped" ? "#f43f5e" :
    "#6800FF";
  return (
    <div className="shrink-0 relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={ringColor} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 tabular-nums">{pct}%</span>
    </div>
  );
}

function formatCampaignCreated(iso?: string | null): string {
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

function StatTile({ label, value, sub, accent, active, onClick }: { label: string; value: number; sub?: string; accent?: "emerald" | "amber" | "indigo" | "rose"; active?: boolean; onClick?: () => void }) {
  const valueColor =
    accent === "emerald" ? "text-emerald-600" :
    accent === "amber" ? "text-amber-600" :
    accent === "indigo" ? "text-indigo-600" :
    accent === "rose" ? "text-rose-600" :
    "text-slate-900";
  const ringColor =
    accent === "emerald" ? "ring-emerald-500" :
    accent === "amber" ? "ring-amber-500" :
    accent === "indigo" ? "ring-indigo-500" :
    accent === "rose" ? "ring-rose-500" :
    "ring-[#6800FF]";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={`text-left bg-white border rounded-xl px-5 py-4 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${
        onClick ? "hover:shadow-md hover:-translate-y-px" : ""
      } ${active ? `border-transparent ring-2 ${ringColor}` : "border-slate-200"}`}
    >
      <p className={`text-[28px] font-bold leading-none tabular-nums ${valueColor}`}>{value.toLocaleString()}</p>
      <p className="text-[12px] font-semibold text-slate-800 mt-2">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </Tag>
  );
}

function DetailMetric({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "violet" | "amber" | "emerald" | "rose" }) {
  const colors: Record<NonNullable<typeof accent>, string> = {
    violet: "text-violet-700",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
  };
  const valueClass = accent ? colors[accent] : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1 leading-none ${valueClass}`}>{value}</p>
      {sub && <p className="text-[10.5px] text-slate-500 mt-1.5">{sub}</p>}
    </div>
  );
}

type ClientAccountGroup = {
  rootKey: string;
  displayDomain: string;
  company: string;
  domains: { domain: string; company: string }[];
};

function AccountsSection({ groups, loading, error }: { groups: ClientAccountGroup[]; loading: boolean; error: string }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = groups.filter((g) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    if (g.displayDomain.includes(q)) return true;
    if (g.rootKey.includes(q)) return true;
    if (g.company.toLowerCase().includes(q)) return true;
    return g.domains.some((d) => d.domain.includes(q) || d.company.toLowerCase().includes(q));
  });

  function toggle(rk: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rk)) next.delete(rk); else next.add(rk);
      return next;
    });
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col" style={{ height: "calc(100vh - 140px)" }}>
      <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-slate-50/60">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-md bg-[#f0e6ff] text-[#6800FF] flex items-center justify-center">
            <Building2 size={14} />
          </span>
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-slate-700">Target Account List</h2>
            <p className="text-[11px] text-slate-500">
              Showing <span className="font-semibold text-slate-700">{filtered.length.toLocaleString()}</span>
              {search.trim() && <> of <span className="font-semibold text-slate-700">{groups.length.toLocaleString()}</span></>}
              <span> {filtered.length === 1 ? "domain" : "domains"}</span>
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domain or company…"
            className="w-64 pl-8 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-400">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading accounts…
          </div>
        ) : error ? (
          <div className="m-4 p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">
            <Building2 size={22} className="text-slate-300 mx-auto mb-2" />
            {groups.length > 0 ? "No matches for your search." : "No accounts available yet."}
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="text-left px-4 py-2.5 w-16 bg-slate-50 border-b border-slate-200">S.No</th>
                <th className="text-left px-4 py-2.5 w-12 bg-slate-50 border-b border-slate-200"></th>
                <th className="text-left px-4 py-2.5 bg-slate-50 border-b border-slate-200">Domain</th>
                <th className="text-left px-4 py-2.5 bg-slate-50 border-b border-slate-200">Company</th>
                <th className="text-right px-4 py-2.5 w-36 bg-slate-50 border-b border-slate-200">Sub-domains</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g, i) => {
                const subCount = g.domains.length;
                const expandable = subCount > 1;
                const isOpen = expandable && expanded.has(g.rootKey);
                const cellBase = "px-4 py-3 border-b border-slate-100";
                return (
                  <Fragment key={g.rootKey}>
                    <tr
                      onClick={() => expandable && toggle(g.rootKey)}
                      className={`hover:bg-slate-50/70 transition-colors ${expandable ? "cursor-pointer" : ""}`}
                    >
                      <td className={`${cellBase} w-16 text-[12px] text-slate-500 tabular-nums`}>{i + 1}</td>
                      <td className={`${cellBase} w-12`}>
                        {expandable ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggle(g.rootKey); }}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-[#6800FF] hover:bg-[#f0e6ff] transition-colors"
                            title={isOpen ? "Collapse" : "Expand"}
                          >
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        ) : (
                          <span className="w-6 h-6 inline-block" />
                        )}
                      </td>
                      <td className={cellBase}>
                        <span className="text-[13px] font-semibold text-slate-900">{g.displayDomain}</span>
                      </td>
                      <td className={`${cellBase} text-[12.5px] text-slate-700`}>{g.company || <span className="text-slate-300">—</span>}</td>
                      <td className={`${cellBase} text-right w-36`}>
                        <span className={`inline-flex items-center justify-center min-w-[28px] h-[20px] px-2 text-[11px] font-bold rounded-full ${subCount > 1 ? "bg-[#f0e6ff] text-[#6800FF]" : "bg-slate-100 text-slate-500"}`}>
                          {subCount}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={5} className="px-4 pt-2 pb-3 border-b border-slate-100">
                          <div className="ml-[6.5rem] border-l-2 border-[#6800FF]/20 pl-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Sub-domains</p>
                            <ul className="space-y-1">
                              {g.domains.map((d) => (
                                <li key={d.domain} className="flex items-center gap-2 text-[12.5px]">
                                  <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                                  <span className="font-mono text-slate-700">{d.domain}</span>
                                  {d.company && d.company !== g.company && (
                                    <span className="text-[11px] text-slate-500">· {d.company}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
