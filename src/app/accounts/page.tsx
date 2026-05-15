"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { Building2, Search, Loader2, RefreshCw, UploadCloud, Link2, Ban, CheckCircle2, AlertTriangle, X, Save, ListX } from "lucide-react";
import { resolveProjectLogo } from "@/lib/client-logo";

type ClientCard = {
  projectId: string;
  clientId: string;
  clientName: string;
  websiteUrl: string;
  logoUrl: string;
  uploaded: number;
  uniqueDomains: number;
  dncCount: number;
  hasSheet: boolean;
  originalFileName: string;
  updatedAt: string | null;
};

type Group = {
  rootKey: string;
  displayDomain: string;
  company: string;
  domains: { domain: string; company: string }[];
};

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

type Totals = { uploaded: number; dnc: number; net: number; uniqueDomains: number; manualDnc: number; manualDncMatched: number };

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

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const m = Math.round(diffMs / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TAG_PALETTE: { bg: string; text: string; ring: string }[] = [
  { bg: "bg-violet-100", text: "text-violet-800", ring: "ring-violet-200" },
  { bg: "bg-emerald-100", text: "text-emerald-800", ring: "ring-emerald-200" },
  { bg: "bg-sky-100", text: "text-sky-800", ring: "ring-sky-200" },
  { bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-200" },
  { bg: "bg-rose-100", text: "text-rose-800", ring: "ring-rose-200" },
  { bg: "bg-indigo-100", text: "text-indigo-800", ring: "ring-indigo-200" },
  { bg: "bg-teal-100", text: "text-teal-800", ring: "ring-teal-200" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-800", ring: "ring-fuchsia-200" },
];

function colorForKey(key: string): { bg: string; text: string; ring: string } {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

export default function AccountsPage() {
  const { user, hydrated } = useAuth();
  const [cards, setCards] = useState<ClientCard[] | null>(null);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const [clientsData, setClientsData] = useState<Record<string, ListResponse>>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [dncModalOpen, setDncModalOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFlash, setUploadFlash] = useState("");
  const [uploadError, setUploadError] = useState("");

  const canAccess = !!user && ["admin", "superadmin"].includes(user.role);

  const fetchCards = useCallback(async () => {
    if (!user?.email) return;
    setCardsLoading(true);
    setCardsError("");
    try {
      const res = await fetch(`/api/accounts/clients?actor=${encodeURIComponent(user.email)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setCardsError(json.error || "Failed to load clients"); return; }
      setCards(json.cards || []);
    } catch (e) {
      setCardsError(e instanceof Error ? e.message : "Network error");
    } finally {
      setCardsLoading(false);
    }
  }, [user?.email]);

  useEffect(() => { if (canAccess) void fetchCards(); }, [canAccess, fetchCards]);

  const fetchSelectedData = useCallback(async () => {
    if (!user?.email || selectedProjectIds.length === 0) { setClientsData({}); return; }
    setDataLoading(true);
    setDataError("");
    try {
      const results = await Promise.all(
        selectedProjectIds.map(async (pid) => {
          const res = await fetch(`/api/accounts/list?actor=${encodeURIComponent(user.email)}&projectId=${encodeURIComponent(pid)}`, { cache: "no-store" });
          const json = await res.json();
          if (!res.ok) throw new Error(`${pid}: ${json.error || "failed"}`);
          return [pid, json as ListResponse] as const;
        }),
      );
      const next: Record<string, ListResponse> = {};
      for (const [pid, json] of results) next[pid] = json;
      setClientsData(next);
    } catch (e) {
      setDataError(e instanceof Error ? e.message : "Network error");
    } finally {
      setDataLoading(false);
    }
  }, [user?.email, selectedProjectIds]);

  useEffect(() => { void fetchSelectedData(); }, [fetchSelectedData]);

  function toggleClient(projectId: string) {
    setSelectedProjectIds((prev) => prev.includes(projectId) ? prev.filter((p) => p !== projectId) : [...prev, projectId]);
  }
  function clearSelection() { setSelectedProjectIds([]); }

  const filteredCards = useMemo(() => {
    if (!cards) return [];
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => c.clientName.toLowerCase().includes(q) || c.clientId.toLowerCase().includes(q));
  }, [cards, search]);

  const flatRows = useMemo(() => {
    const out: { projectId: string; clientName: string; domain: string; company: string; rootKey: string }[] = [];
    for (const pid of selectedProjectIds) {
      const d = clientsData[pid];
      if (!d) continue;
      const clientName = d.clientName || cards?.find((c) => c.projectId === pid)?.clientName || pid;
      for (const g of d.groups) {
        for (const dom of g.domains) {
          out.push({
            projectId: pid,
            clientName,
            domain: dom.domain,
            company: dom.company || g.company || "",
            rootKey: g.rootKey,
          });
        }
      }
    }
    return out;
  }, [clientsData, selectedProjectIds, cards]);

  const combinedTotals = useMemo(() => {
    let uploaded = 0, unique = 0, dncMatched = 0, dncOnList = 0;
    for (const pid of selectedProjectIds) {
      const d = clientsData[pid];
      if (!d) continue;
      uploaded += d.totals.uploaded;
      unique += d.totals.uniqueDomains;
      dncMatched += d.totals.manualDncMatched;
      dncOnList += d.totals.manualDnc;
    }
    return { uploaded, unique, dncMatched, dncOnList };
  }, [clientsData, selectedProjectIds]);

  const activeProjectId = selectedProjectIds.length === 1 ? selectedProjectIds[0] : "";

  const handleUpload = useCallback(async (file: File) => {
    if (!user?.email || !activeProjectId) return;
    setUploading(true);
    setUploadError("");
    setUploadFlash("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("actor", user.email);
      fd.append("projectId", activeProjectId);
      const res = await fetch("/api/accounts/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error || "Upload failed"); return; }
      setUploadFlash(`Uploaded ${json.uploaded} rows · ${json.uniqueDomains} unique`);
      await Promise.all([fetchSelectedData(), fetchCards()]);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Network error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [user?.email, activeProjectId, fetchSelectedData, fetchCards]);

  if (!hydrated) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (!canAccess) return <div className="p-8"><p className="text-sm text-slate-600">You don&apos;t have access to Account Details.</p></div>;

  const activeData: ListResponse | null = activeProjectId ? clientsData[activeProjectId] || null : null;
  const activeCard = activeProjectId ? cards?.find((c) => c.projectId === activeProjectId) || null : null;

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="shrink-0 px-6 pt-5 pb-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Account Details</h1>
          <p className="text-xs text-slate-500 mt-0.5">Select a client on the left to view their Target Account List as a live sheet.</p>
        </div>
        <button
          onClick={() => fetchCards()}
          disabled={cardsLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
        >
          <RefreshCw size={12} className={cardsLoading ? "animate-spin" : ""} /> Refresh Clients
        </button>
      </header>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients…"
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
              />
            </div>
            <div className="mt-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Clients · {selectedProjectIds.length} selected</span>
              {selectedProjectIds.length > 0 ? (
                <button onClick={clearSelection} className="text-[10px] font-bold text-[#6800FF] hover:underline">Clear</button>
              ) : (
                <span className="text-slate-400">{filteredCards.length}/{cards?.length || 0}</span>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {cardsLoading ? (
              <div className="flex items-center justify-center py-10 text-xs text-slate-400">
                <Loader2 size={12} className="animate-spin mr-2" /> Loading…
              </div>
            ) : cardsError ? (
              <div className="m-3 p-2.5 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">{cardsError}</div>
            ) : filteredCards.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-slate-400">No clients match.</div>
            ) : (
              <ul className="py-1">
                {filteredCards.map((c) => {
                  const isSelected = selectedProjectIds.includes(c.projectId);
                  const logo = resolveProjectLogo({ clientName: c.clientName, websiteUrl: c.websiteUrl, logoUrl: c.logoUrl });
                  const initial = (c.clientName || "?").trim().charAt(0).toUpperCase();
                  const tag = colorForKey(c.projectId);
                  return (
                    <li key={c.projectId}>
                      <button
                        onClick={() => toggleClient(c.projectId)}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                          isSelected ? "bg-[#f0e6ff] hover:bg-[#e7d8ff]" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? "bg-[#6800FF] border-[#6800FF]" : "bg-white border-slate-300"
                        }`}>
                          {isSelected && <CheckCircle2 size={10} className="text-white" strokeWidth={3} />}
                        </span>
                        <span className={`shrink-0 w-1.5 h-7 rounded-full ${tag.bg}`} aria-hidden />
                        <div className="shrink-0 w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
                          {logo ? (
                            <Image src={logo} alt={c.clientName} width={24} height={24} className="object-contain" unoptimized />
                          ) : (
                            <span className="text-xs font-bold text-slate-500">{initial}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12.5px] font-semibold truncate ${isSelected ? "text-[#6800FF]" : "text-slate-800"}`}>
                            {c.clientName || c.projectId}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {c.hasSheet ? `${c.uploaded.toLocaleString()} rows · ${c.uniqueDomains.toLocaleString()} unique` : "No sheet yet"}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col">
          {selectedProjectIds.length === 0 ? (
            <EmptyState message="Tick one or more clients on the left to see their sheet(s)." />
          ) : dataLoading && Object.keys(clientsData).length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin mr-2" /> Loading sheet…
            </div>
          ) : dataError ? (
            <div className="m-6 p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">{dataError}</div>
          ) : (
            <SheetView
              activeData={activeData}
              activeCard={activeCard}
              isMulti={selectedProjectIds.length > 1}
              selectedCount={selectedProjectIds.length}
              combinedTotals={combinedTotals}
              flatRows={flatRows}
              loading={dataLoading}
              uploading={uploading}
              uploadFlash={uploadFlash}
              uploadError={uploadError}
              onRefresh={fetchSelectedData}
              onUploadClick={() => fileRef.current?.click()}
              onConnectClick={() => setSheetModalOpen(true)}
              onDncClick={() => setDncModalOpen(true)}
            />
          )}
        </main>
      </div>

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

      {sheetModalOpen && user?.email && activeProjectId && (
        <ConnectSheetModal
          actor={user.email}
          projectId={activeProjectId}
          current={activeData?.googleSheet || null}
          onClose={() => setSheetModalOpen(false)}
          onConnected={async () => {
            setSheetModalOpen(false);
            await Promise.all([fetchSelectedData(), fetchCards()]);
          }}
        />
      )}

      {dncModalOpen && user?.email && activeProjectId && activeData && (
        <DncModal
          actor={user.email}
          projectId={activeProjectId}
          initial={activeData.manualDnc || []}
          totalsOnList={activeData.totals.manualDnc}
          totalsMatched={activeData.totals.manualDncMatched}
          onClose={() => setDncModalOpen(false)}
          onSaved={async () => { await fetchSelectedData(); }}
        />
      )}
    </div>
  );

  function EmptyState({ message }: { message: string }) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
        <Building2 size={32} className="text-slate-300 mb-2" />
        <p className="text-sm">{message}</p>
      </div>
    );
  }
}

function SheetView({
  activeData, activeCard, isMulti, selectedCount, combinedTotals, flatRows, loading, uploading, uploadFlash, uploadError,
  onRefresh, onUploadClick, onConnectClick, onDncClick,
}: {
  activeData: ListResponse | null;
  activeCard: ClientCard | null;
  isMulti: boolean;
  selectedCount: number;
  combinedTotals: { uploaded: number; unique: number; dncMatched: number; dncOnList: number };
  flatRows: { projectId: string; clientName: string; domain: string; company: string; rootKey: string }[];
  loading: boolean;
  uploading: boolean;
  uploadFlash: string;
  uploadError: string;
  onRefresh: () => void;
  onUploadClick: () => void;
  onConnectClick: () => void;
  onDncClick: () => void;
}) {
  const headerTitle = isMulti
    ? `Combined View · ${selectedCount} Clients`
    : (activeData?.clientName || activeCard?.clientName || "Client");
  const colLetters = isMulti ? ["A", "B", "C"] : ["A", "B"];

  return (
    <>
      <div className="shrink-0 px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-slate-900 truncate">
            {headerTitle}
            {!isMulti && activeData?.clientId && <span className="ml-2 text-[11px] font-mono text-slate-500 align-middle">{activeData.clientId}</span>}
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {flatRows.length.toLocaleString()} rows
            {isMulti
              ? <> · {combinedTotals.unique.toLocaleString()} unique across clients · {combinedTotals.dncMatched.toLocaleString()} excluded by DNC</>
              : activeData && <> · {activeData.totals.uniqueDomains.toLocaleString()} unique · {activeData.totals.manualDncMatched.toLocaleString()} excluded by DNC</>}
            {!isMulti && activeData?.googleSheet && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#6800FF]">
                <Link2 size={9} /> {activeData.googleSheet.tabTitle} {activeData.syncedNow ? "· synced" : `· ${fmtRelative(activeData.googleSheet.lastSyncAt)}`}
              </span>
            )}
            {!isMulti && activeData?.syncError && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700">
                <AlertTriangle size={9} /> {activeData.syncError}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onDncClick}
            disabled={isMulti}
            title={isMulti ? "Select a single client to manage DNC" : ""}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Ban size={12} /> DNC{!isMulti && activeData ? ` (${activeData.totals.manualDnc})` : ""}
          </button>
          <button
            onClick={onUploadClick}
            disabled={uploading || isMulti}
            title={isMulti ? "Select a single client to upload" : ""}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} Upload XLSX
          </button>
          <button
            onClick={onConnectClick}
            disabled={isMulti}
            title={isMulti ? "Select a single client to manage the sheet" : ""}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6800FF] hover:bg-[#5800DD] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Link2 size={12} /> {activeData?.googleSheet ? "Change Sheet" : "Connect Sheet"}
          </button>
          <button onClick={onRefresh} disabled={loading} className="inline-flex items-center justify-center w-8 h-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-60" title="Refresh">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {(uploadError || uploadFlash) && (
        <div className={`mx-5 mt-3 text-xs px-3 py-2 rounded-lg border ${uploadError ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          {uploadError || uploadFlash}
        </div>
      )}

      <div className="flex-1 min-h-0 m-5 mt-3 rounded-lg border border-slate-300 bg-white overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          {flatRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Building2 size={26} className="text-slate-300 mb-2" />
              <p className="text-sm">No data yet — upload an XLSX or connect a Google Sheet to begin.</p>
            </div>
          ) : (
            <table className="border-collapse text-[12.5px]" style={{ minWidth: "100%" }}>
              <thead>
                <tr className="sticky top-0 z-20 bg-[#f1f3f4] text-slate-600">
                  <th className="sticky left-0 z-30 bg-[#f1f3f4] w-12 h-7 px-2 border-b border-r border-slate-300 text-[10.5px] font-semibold"></th>
                  {colLetters.map((l) => (
                    <th key={l} className="h-7 px-3 border-b border-r border-slate-300 text-[10.5px] font-semibold text-center min-w-[120px]">
                      {l}
                    </th>
                  ))}
                </tr>
                <tr className="sticky top-7 z-20 bg-white text-slate-700">
                  <th className="sticky left-0 z-30 bg-[#f8f9fa] w-12 h-9 px-2 border-b border-r border-slate-300 text-[10.5px] font-bold text-center">1</th>
                  {isMulti && (
                    <th className="h-9 px-3 border-b border-r border-slate-300 text-left text-[11.5px] font-semibold min-w-[160px]">Client</th>
                  )}
                  <th className="h-9 px-3 border-b border-r border-slate-300 text-left text-[11.5px] font-semibold min-w-[260px]">Domain</th>
                  <th className="h-9 px-3 border-b border-r border-slate-300 text-left text-[11.5px] font-semibold min-w-[320px]">Company</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((r, i) => {
                  const tag = colorForKey(r.projectId);
                  return (
                    <tr key={`${r.projectId}-${r.domain}-${i}`} className="hover:bg-[#f0fbff]">
                      <td className="sticky left-0 z-10 bg-[#f8f9fa] w-12 h-8 px-2 border-b border-r border-slate-200 text-[10.5px] font-semibold text-slate-500 text-center tabular-nums">
                        {i + 2}
                      </td>
                      {isMulti && (
                        <td className="h-8 px-3 border-b border-r border-slate-200">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold ring-1 ${tag.bg} ${tag.text} ${tag.ring}`}>
                            <span className="w-1 h-1 rounded-full bg-current opacity-60" />
                            {r.clientName}
                          </span>
                        </td>
                      )}
                      <td className="h-8 px-3 border-b border-r border-slate-200 text-slate-900 font-medium">{r.domain}</td>
                      <td className="h-8 px-3 border-b border-r border-slate-200 text-slate-700 truncate max-w-md">{r.company || <span className="text-slate-300">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
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
    setError(""); setSuccess(""); setTabs(null); setLoadingTabs(true);
    try {
      const res = await fetch("/api/accounts/connect-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor, projectId, sheetUrl }),
      });
      const json = await res.json();
      if (!res.ok) { setError(`${json.error || "Failed"}${json.hint ? ` — ${json.hint}` : ""}`); return; }
      setSpreadsheetId(json.spreadsheetId);
      setTabs(json.tabs || []);
      if (!selectedTab && json.tabs?.length) setSelectedTab(json.tabs[0].title);
    } catch (e) { setError(e instanceof Error ? e.message : "Network error"); }
    finally { setLoadingTabs(false); }
  }

  async function connect() {
    setError(""); setSuccess(""); setSaving(true);
    try {
      const tabMeta = tabs?.find((t) => t.title === selectedTab);
      const res = await fetch("/api/accounts/save-tab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor, projectId, sheetUrl, spreadsheetId, tabTitle: selectedTab, tabSheetId: tabMeta?.sheetId }),
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
            <span className="w-8 h-8 rounded-md bg-[#f0e6ff] text-[#6800FF] flex items-center justify-center"><Link2 size={15} /></span>
            <div>
              <h2 className="text-[14px] font-bold text-slate-900">Connect Google Sheet</h2>
              <p className="text-[11px] text-slate-500">Live sync — the sheet view refreshes on every page load.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Step 1 · Sheet URL</label>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-2">Paste the link. The sheet must be set to <span className="font-semibold">&quot;Anyone with the link can view&quot;</span>.</p>
            <div className="flex gap-2">
              <input
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className="flex-1 px-3 py-2 text-[12.5px] font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
              />
              <button onClick={loadTabs} disabled={loadingTabs || !sheetUrl.trim()} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors disabled:opacity-50">
                {loadingTabs ? <Loader2 size={12} className="animate-spin" /> : null} Load tabs
              </button>
            </div>
          </div>
          {tabs && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Step 2 · Pick a tab</label>
              <p className="text-[11px] text-slate-500 mt-0.5 mb-2">{tabs.length} {tabs.length === 1 ? "tab" : "tabs"} found.</p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {tabs.map((t) => (
                  <button key={t.title} onClick={() => setSelectedTab(t.title)} className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between gap-2 ${selectedTab === t.title ? "border-[#6800FF] bg-[#f0e6ff]" : "border-slate-200 hover:bg-slate-50"}`}>
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
            <p className="font-semibold text-slate-700 mb-1">Required fields:</p>
            <ul className="space-y-0.5">
              <li>• <span className="font-mono text-slate-900">Domain</span> — header can also be Website / URL / Site</li>
              <li>• <span className="font-mono text-slate-900">Company</span> — header can also be Company Name / Account / Brand <span className="text-slate-400">(optional)</span></li>
            </ul>
          </div>
          {error && <div className="text-[12px] px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700">{error}</div>}
          {success && <div className="text-[12px] px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">{success}</div>}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={connect} disabled={saving || !selectedTab || !tabs || tabs.length === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6800FF] hover:bg-[#5800DD] disabled:opacity-50 rounded-lg transition-colors">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {saving ? "Connecting…" : "Connect & Sync"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DncModal({ actor, projectId, initial, totalsOnList, totalsMatched, onClose, onSaved }: {
  actor: string;
  projectId: string;
  initial: string[];
  totalsOnList: number;
  totalsMatched: number;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [text, setText] = useState(initial.join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  async function save() {
    setSaving(true); setError(""); setFlash("");
    try {
      const res = await fetch("/api/accounts/dnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor, projectId, raw: text }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Save failed"); return; }
      setFlash(`Saved ${json.count} domains`);
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Network error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center"><Ban size={15} /></span>
            <div>
              <h2 className="text-[14px] font-bold text-slate-900">DNC List for this Client</h2>
              <p className="text-[11px] text-slate-500">{totalsOnList} on list · {totalsMatched} matched in current sheet.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"One domain per line\nmamaearth.co\nnykaa.com"}
            rows={10}
            className="w-full px-3 py-2 text-[12.5px] font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10 resize-y"
          />
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <ListX size={11} className="text-slate-400" />
            Matches root domain too — adding <span className="font-mono">mamaearth.co</span> will also exclude <span className="font-mono">mamaearth.ae</span>.
          </div>
          {error && <div className="text-[12px] px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700">{error}</div>}
          {flash && <div className="text-[12px] px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">{flash}</div>}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors">Close</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6800FF] hover:bg-[#5800DD] disabled:opacity-50 rounded-lg transition-colors">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save DNC List
          </button>
        </div>
      </div>
    </div>
  );
}
