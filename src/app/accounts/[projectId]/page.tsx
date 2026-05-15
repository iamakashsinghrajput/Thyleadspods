"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Building2, Search, UploadCloud, Loader2, ChevronDown, ChevronRight, FileSpreadsheet, ShieldOff, Globe, RefreshCw, Ban, Save, ListX, ArrowLeft, Link2, X, CheckCircle2, AlertTriangle } from "lucide-react";

type Group = {
  rootKey: string;
  displayDomain: string;
  company: string;
  domains: { domain: string; company: string }[];
};

type Totals = { uploaded: number; dnc: number; net: number; uniqueDomains: number; manualDnc: number; manualDncMatched: number };

type GoogleSheetMeta = {
  sheetUrl: string;
  spreadsheetId: string;
  tabTitle: string;
  tabSheetId: number | null;
  connectedAt: string | null;
  connectedBy: string;
  lastSyncAt: string | null;
  lastSyncError: string;
  domainColumn: string;
  companyColumn: string;
};

type ListResponse = {
  projectId: string;
  clientName: string;
  clientId: string;
  groups: Group[];
  totals: Totals;
  manualDnc: string[];
  manualDncUpdatedAt: string | null;
  manualDncUpdatedBy: string;
  originalFileName: string;
  uploadedBy: string;
  updatedAt: string | null;
  source?: "upload" | "google-sheet" | "none";
  googleSheet?: GoogleSheetMeta | null;
  syncedNow?: boolean;
  syncError?: string;
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${String(h).padStart(2, "0")}:${mm} ${ampm}`;
}

export default function AccountsDetailPage() {
  const { user, hydrated } = useAuth();
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId || "";
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dncOpen, setDncOpen] = useState(false);
  const [dncText, setDncText] = useState("");
  const [dncDirty, setDncDirty] = useState(false);
  const [savingDnc, setSavingDnc] = useState(false);
  const [dncStatus, setDncStatus] = useState("");
  const [dncError, setDncError] = useState("");
  const [sheetModalOpen, setSheetModalOpen] = useState(false);

  const canAccess = !!user && ["admin", "superadmin"].includes(user.role);
  const dncDirtyRef = useRef(false);
  useEffect(() => { dncDirtyRef.current = dncDirty; }, [dncDirty]);

  const fetchList = useCallback(async () => {
    if (!user?.email || !projectId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/accounts/list?actor=${encodeURIComponent(user.email)}&projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to load accounts"); return; }
      setData(json);
      if (!dncDirtyRef.current) setDncText((json.manualDnc || []).join("\n"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [user?.email, projectId]);

  const saveDnc = useCallback(async () => {
    if (!user?.email || !projectId) return;
    setSavingDnc(true);
    setDncError("");
    setDncStatus("");
    try {
      const res = await fetch("/api/accounts/dnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: user.email, projectId, raw: dncText }),
      });
      const json = await res.json();
      if (!res.ok) { setDncError(json.error || "Save failed"); return; }
      setDncStatus(`Saved ${json.count} domains`);
      setDncDirty(false);
      setDncText((json.manualDnc || []).join("\n"));
      await fetchList();
    } catch (e) {
      setDncError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSavingDnc(false);
    }
  }, [user?.email, projectId, dncText, fetchList]);

  useEffect(() => { if (canAccess) void fetchList(); }, [canAccess, fetchList]);

  const handleUpload = useCallback(async (file: File) => {
    if (!user?.email || !projectId) return;
    setUploading(true);
    setUploadError("");
    setUploadStatus("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("actor", user.email);
      fd.append("projectId", projectId);
      const res = await fetch("/api/accounts/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        const headers = Array.isArray(json.detectedHeaders) ? ` Headers seen: ${json.detectedHeaders.join(", ")}` : "";
        setUploadError(`${json.error || "Upload failed"}${headers}`);
        return;
      }
      const det = json.detected || {};
      const parts: string[] = [];
      parts.push(`Uploaded ${json.uploaded} rows`);
      if (typeof json.skippedNoDomain === "number" && json.skippedNoDomain > 0) {
        parts.push(`${json.skippedNoDomain} skipped (no domain)`);
      }
      parts.push(`${json.uniqueDomains} unique`);
      const cols = `Matched — Domain: "${det.domain || "?"}", Company: "${det.company || "—"}"`;
      setUploadStatus(`${parts.join(" · ")}. ${cols}`);
      await fetchList();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Network error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [user?.email, projectId, fetchList]);

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.groups;
    return data.groups.filter((g) => {
      if (g.rootKey.includes(q)) return true;
      if (g.displayDomain.includes(q)) return true;
      if (g.company.toLowerCase().includes(q)) return true;
      return g.domains.some((d) => d.domain.includes(q) || d.company.toLowerCase().includes(q));
    });
  }, [data, search]);

  function toggleExpand(rootKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rootKey)) next.delete(rootKey);
      else next.add(rootKey);
      return next;
    });
  }

  if (!hydrated) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (!canAccess) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-600">You don&apos;t have access to Account Details.</p>
      </div>
    );
  }

  const totals = data?.totals;

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="px-6 pt-5 pb-4 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href="/accounts" className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#6800FF] transition-colors">
              <ArrowLeft size={12} /> All Clients
            </Link>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              {data?.clientName || "Account Details"}
              {data?.clientId && <span className="ml-2 text-[11px] font-mono text-slate-500 align-middle">{data.clientId}</span>}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload the Total Accounts sheet for this client (only Domain + Company columns needed). Sub-domains are grouped automatically.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchList()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
              {uploading ? "Uploading…" : "Upload XLSX"}
            </button>
            <button
              onClick={() => setSheetModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6800FF] hover:bg-[#5800DD] rounded-lg transition-colors"
            >
              <Link2 size={12} />
              {data?.googleSheet ? "Change Google Sheet" : "Connect Google Sheet"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-5">
          <StatCard icon={<FileSpreadsheet size={14} />} label="Uploaded" value={totals?.uploaded ?? 0} tint="slate" />
          <StatCard
            icon={<ShieldOff size={14} />}
            label="DNC Removed"
            value={totals?.manualDncMatched ?? 0}
            tint="rose"
            sublabel={totals ? `${totals.manualDnc} on DNC list` : undefined}
          />
          <StatCard icon={<Building2 size={14} />} label="Net Accounts" value={totals?.net ?? 0} tint="emerald" />
          <StatCard icon={<Globe size={14} />} label="Unique Domains" value={totals?.uniqueDomains ?? 0} tint="violet" />
        </div>

        {(uploadError || uploadStatus) && (
          <div className={`mt-3 text-xs px-3 py-2 rounded-lg border ${uploadError ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
            {uploadError || uploadStatus}
          </div>
        )}

        {data?.googleSheet && (
          <div className="mt-3 px-3 py-2 rounded-lg border border-violet-200 bg-violet-50/60 text-xs flex items-center gap-2.5">
            <Link2 size={13} className="text-[#6800FF] shrink-0" />
            <span className="text-slate-700">
              Connected to Google Sheet · Tab <span className="font-semibold text-slate-900">{data.googleSheet.tabTitle}</span>
              {data.syncedNow ? <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><CheckCircle2 size={10} /> just synced</span> : null}
            </span>
            {data.googleSheet.sheetUrl && (
              <a href={data.googleSheet.sheetUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-[#6800FF] hover:underline ml-auto">Open sheet ↗</a>
            )}
            {data.syncError && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 ml-2"><AlertTriangle size={10} /> {data.syncError}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-4">
          <div className="text-[11px] text-slate-500">
            {data?.originalFileName ? (
              <>
                <span className="font-mono text-slate-700">{data.originalFileName}</span>
                <span className="mx-1.5">·</span>
                Last updated {fmtDateTime(data?.updatedAt ?? null)}
                {data?.uploadedBy ? <> · by <span className="font-mono">{data.uploadedBy}</span></> : null}
              </>
            ) : (
              <span>No sheet uploaded yet for this client.</span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search domain or company…"
              className="w-64 pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col px-6 py-4 gap-4">
        <section className="bg-white border border-slate-200 rounded-xl shrink-0">
          <button
            onClick={() => setDncOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 group"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
                <Ban size={13} />
              </span>
              <div className="text-left">
                <h2 className="text-[13px] font-bold text-slate-900">DNC List</h2>
                <p className="text-[11px] text-slate-500">
                  Manually exclude domains for this client. {data?.totals?.manualDnc ?? 0} on list · {data?.totals?.manualDncMatched ?? 0} matched.
                </p>
              </div>
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${dncOpen ? "rotate-180" : ""}`} />
          </button>
          {dncOpen && (
            <div className="px-4 pb-4 pt-1 border-t border-slate-100">
              <textarea
                value={dncText}
                onChange={(e) => { setDncText(e.target.value); setDncDirty(true); setDncStatus(""); setDncError(""); }}
                placeholder={"One domain per line\nmamaearth.co\nnykaa.com\nlenskart.com"}
                rows={8}
                className="w-full px-3 py-2 text-[12.5px] font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10 resize-y"
              />
              <div className="flex items-center justify-between gap-3 mt-2">
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <ListX size={11} className="text-slate-400" />
                  Matches root domain too — adding <span className="font-mono">mamaearth.co</span> will exclude <span className="font-mono">mamaearth.ae</span> as well.
                </div>
                <div className="flex items-center gap-2">
                  {(dncError || dncStatus) && (
                    <span className={`text-[11px] ${dncError ? "text-rose-600" : "text-emerald-600"}`}>
                      {dncError || dncStatus}
                    </span>
                  )}
                  <button
                    onClick={saveDnc}
                    disabled={savingDnc || !dncDirty}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6800FF] hover:bg-[#5800DD] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingDnc ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {savingDnc ? "Saving…" : "Save DNC List"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-slate-600">Accounts</h2>
            <div className="text-[11px] text-slate-500 tabular-nums">
              {data ? (
                <>
                  Showing <span className="font-semibold text-slate-700">{filteredGroups.length.toLocaleString()}</span>
                  {search.trim() && <> of <span className="font-semibold text-slate-700">{data.groups.length.toLocaleString()}</span></>}
                  <span> {filteredGroups.length === 1 ? "domain" : "domains"}</span>
                </>
              ) : "—"}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin mr-2" /> Loading accounts…
              </div>
            ) : error ? (
              <div className="m-4 p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">{error}</div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-16 text-sm text-slate-400">
                <Building2 size={22} className="text-slate-300 mx-auto mb-2" />
                {data && data.groups.length > 0 ? "No matches for your search." : "Upload a Total Accounts sheet for this client to begin."}
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
                  {filteredGroups.map((g, i) => {
                    const isOpen = expanded.has(g.rootKey);
                    const subCount = g.domains.length;
                    const expandable = subCount > 1;
                    return (
                      <FragmentRow
                        key={g.rootKey}
                        index={i + 1}
                        group={g}
                        isOpen={isOpen && expandable}
                        subCount={subCount}
                        expandable={expandable}
                        onToggle={() => expandable && toggleExpand(g.rootKey)}
                      />
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {sheetModalOpen && user?.email && (
        <ConnectSheetModal
          actor={user.email}
          projectId={projectId}
          current={data?.googleSheet || null}
          onClose={() => setSheetModalOpen(false)}
          onConnected={async () => {
            setSheetModalOpen(false);
            await fetchList();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, tint, sublabel }: { icon: React.ReactNode; label: string; value: number; tint: "slate" | "rose" | "emerald" | "violet"; sublabel?: string }) {
  const tones: Record<typeof tint, { bg: string; text: string; iconBg: string }> = {
    slate: { bg: "bg-slate-50", text: "text-slate-900", iconBg: "bg-slate-100 text-slate-600" },
    rose: { bg: "bg-rose-50", text: "text-rose-700", iconBg: "bg-rose-100 text-rose-600" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100 text-emerald-600" },
    violet: { bg: "bg-violet-50", text: "text-violet-700", iconBg: "bg-violet-100 text-violet-600" },
  };
  const t = tones[tint];
  return (
    <div className={`${t.bg} border border-slate-200 rounded-lg px-3 py-2.5 flex items-center gap-3`}>
      <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${t.iconBg}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`text-base font-bold tabular-nums ${t.text}`}>{value.toLocaleString()}</p>
        {sublabel && <p className="text-[10px] text-slate-500 truncate">{sublabel}</p>}
      </div>
    </div>
  );
}

function FragmentRow({ index, group, isOpen, subCount, expandable, onToggle }: { index: number; group: Group; isOpen: boolean; subCount: number; expandable: boolean; onToggle: () => void }) {
  const cellBase = "px-4 py-3 border-b border-slate-100";
  return (
    <>
      <tr onClick={onToggle} className={`group/row hover:bg-slate-50/70 transition-colors ${expandable ? "cursor-pointer" : ""}`}>
        <td className={`${cellBase} w-16 text-[12px] text-slate-500 tabular-nums`}>{index}</td>
        <td className={`${cellBase} w-12`}>
          {expandable ? (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
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
          <span className="text-[13px] font-semibold text-slate-900">{group.displayDomain}</span>
        </td>
        <td className={`${cellBase} text-[12.5px] text-slate-700`}>{group.company || <span className="text-slate-300">—</span>}</td>
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
                {group.domains.map((d) => (
                  <li key={d.domain} className="flex items-center gap-2 text-[12.5px]">
                    <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                    <span className="font-mono text-slate-700">{d.domain}</span>
                    {d.company && d.company !== group.company && (
                      <span className="text-[11px] text-slate-500">· {d.company}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

type Tab = { title: string; sheetId: number; rowCount: number; columnCount: number };

function ConnectSheetModal({ actor, projectId, current, onClose, onConnected }: {
  actor: string;
  projectId: string;
  current: GoogleSheetMeta | null;
  onClose: () => void;
  onConnected: () => Promise<void> | void;
}) {
  const [sheetUrl, setSheetUrl] = useState(current?.sheetUrl || "");
  const [spreadsheetId, setSpreadsheetId] = useState(current?.spreadsheetId || "");
  const [tabs, setTabs] = useState<Tab[] | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>(current?.tabTitle || "");
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadTabs() {
    setError("");
    setSuccess("");
    setTabs(null);
    setLoadingTabs(true);
    try {
      const res = await fetch("/api/accounts/connect-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor, projectId, sheetUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(`${json.error || "Failed"}${json.hint ? ` — ${json.hint}` : ""}`);
        return;
      }
      setSpreadsheetId(json.spreadsheetId);
      setTabs(json.tabs || []);
      if (!selectedTab && json.tabs?.length) setSelectedTab(json.tabs[0].title);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoadingTabs(false);
    }
  }

  async function connect() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const tabMeta = tabs?.find((t) => t.title === selectedTab);
      const res = await fetch("/api/accounts/save-tab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor,
          projectId,
          sheetUrl,
          spreadsheetId,
          tabTitle: selectedTab,
          tabSheetId: tabMeta?.sheetId,
        }),
      });
      let json: { error?: string; detectedHeaders?: string[]; uploaded?: number; domainColumn?: string; companyColumn?: string } = {};
      try { json = await res.json(); } catch {}
      if (!res.ok) {
        const hdrs = Array.isArray(json.detectedHeaders) ? ` Headers seen: ${json.detectedHeaders.join(", ")}` : "";
        setError(`${json.error || `HTTP ${res.status}`}${hdrs}`);
        setSaving(false);
        return;
      }
      setSuccess(`Synced ${json.uploaded ?? 0} rows from "${selectedTab}". Domain → "${json.domainColumn ?? "?"}"${json.companyColumn ? `, Company → "${json.companyColumn}"` : ""}.`);
      await onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-md bg-[#f0e6ff] text-[#6800FF] flex items-center justify-center">
              <Link2 size={15} />
            </span>
            <div>
              <h2 className="text-[14px] font-bold text-slate-900">Connect Google Sheet</h2>
              <p className="text-[11px] text-slate-500">Live sync — the dashboard refreshes every time the sheet is updated.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Step 1 · Sheet URL</label>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-2">
              Paste the link to your Google Sheet. The sheet must be set to <span className="font-semibold">&quot;Anyone with the link can view&quot;</span>.
            </p>
            <div className="flex gap-2">
              <input
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className="flex-1 px-3 py-2 text-[12.5px] font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
              />
              <button
                onClick={loadTabs}
                disabled={loadingTabs || !sheetUrl.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors disabled:opacity-50"
              >
                {loadingTabs ? <Loader2 size={12} className="animate-spin" /> : null}
                Load tabs
              </button>
            </div>
          </div>

          {tabs && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Step 2 · Pick a tab</label>
              <p className="text-[11px] text-slate-500 mt-0.5 mb-2">
                {tabs.length} {tabs.length === 1 ? "tab" : "tabs"} found in this sheet.
              </p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {tabs.map((t) => (
                  <button
                    key={t.title}
                    onClick={() => setSelectedTab(t.title)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                      selectedTab === t.title
                        ? "border-[#6800FF] bg-[#f0e6ff]"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${selectedTab === t.title ? "border-[#6800FF] bg-[#6800FF]" : "border-slate-300"}`} />
                      <span className="text-[13px] font-semibold text-slate-900 truncate">{t.title}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{t.rowCount} rows</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-[11px] text-slate-600">
            <p className="font-semibold text-slate-700 mb-1">Required fields in the selected tab:</p>
            <ul className="space-y-0.5">
              <li>• <span className="font-mono text-slate-900">Domain</span> — header can also be Website / URL / Site</li>
              <li>• <span className="font-mono text-slate-900">Company</span> — header can also be Company Name / Account / Brand <span className="text-slate-400">(optional but recommended)</span></li>
            </ul>
          </div>

          {error && (
            <div className="text-[12px] px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700">{error}</div>
          )}
          {success && (
            <div className="text-[12px] px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">{success}</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={connect}
            disabled={saving || !selectedTab || !tabs || tabs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6800FF] hover:bg-[#5800DD] disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {saving ? "Connecting…" : "Connect & Sync"}
          </button>
        </div>
      </div>
    </div>
  );
}
