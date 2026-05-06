"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Mail, Check, AlertTriangle, ChevronRight, ChevronLeft, Copy, ExternalLink, Crown, Zap, X, Sparkles, Loader2, Upload, Layers } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { PilotLeadRow } from "./types";

type LeadFilter = "all" | "decisionMakers" | "shippable" | "issues" | "emailReady" | "recommended" | "skipped";

function isRecommended(l: PilotLeadRow): boolean {
  return l.shouldEmail === "yes" || l.shouldEmail === "maybe" || (!l.shouldEmail && (l.buyerSignalScore || 0) >= 30);
}
function isSkipped(l: PilotLeadRow): boolean {
  return l.shouldEmail === "no";
}

const DECISION_MAKER_TITLE_RE = /\b(founder|co[- ]?founder|cofounder|ceo|chief executive)\b/i;

function isDecisionMaker(l: PilotLeadRow): boolean {
  return DECISION_MAKER_TITLE_RE.test(l.contactTitle || "");
}

function hasUsableEmail(l: PilotLeadRow): boolean {
  return !!l.email && (l.emailStatus === "verified" || l.emailStatus === "likely_to_engage");
}

function isPending(l: PilotLeadRow): boolean {
  const hasPrompt = l.hasPrompt ?? !!l.claudePrompt;
  if (!hasPrompt) return false;
  const fullSeq = l.hasFullSequence ?? !!(l.body1 && l.body2 && l.body3);
  return !fullSeq;
}

function isEmailReady(l: PilotLeadRow): boolean {
  return hasUsableEmail(l) && isPending(l);
}

export default function LeadsTable({ leads, pilotId, onChanged, isTest }: { leads: PilotLeadRow[]; pilotId?: string; onChanged?: () => void; isTest?: boolean }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [active, setActive] = useState<PilotLeadRow | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string>("");
  const [expandedFull, setExpandedFull] = useState<{ claudePrompt: string; subject1: string; body1: string; subject2: string; body2: string; subject3: string; body3: string } | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoMsg, setAutoMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [autoProgress, setAutoProgress] = useState<{ done: number; remaining: number; cost: number } | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter === "shippable" && !l.shippable) return false;
      if (filter === "issues" && (l.shippable || l.validationIssues.length === 0)) return false;
      if (filter === "decisionMakers" && !isDecisionMaker(l)) return false;
      if (filter === "emailReady" && !isEmailReady(l)) return false;
      if (filter === "recommended" && !isRecommended(l)) return false;
      if (filter === "skipped" && !isSkipped(l)) return false;
      if (!s) return true;
      return (
        l.accountDomain.toLowerCase().includes(s) ||
        l.companyShort.toLowerCase().includes(s) ||
        l.fullName.toLowerCase().includes(s) ||
        (l.contactTitle || "").toLowerCase().includes(s) ||
        (l.observationAngle || "").toLowerCase().includes(s)
      );
    });
  }, [leads, q, filter]);

  const decisionMakerCount = useMemo(() => leads.filter(isDecisionMaker).length, [leads]);
  const pendingCount = useMemo(() => leads.filter(isPending).length, [leads]);
  const emailReadyCount = useMemo(() => leads.filter(isEmailReady).length, [leads]);
  const shippableCount = useMemo(() => leads.filter((l) => l.shippable).length, [leads]);
  const recommendedCount = useMemo(() => leads.filter(isRecommended).length, [leads]);
  const skippedCount = useMemo(() => leads.filter(isSkipped).length, [leads]);

  async function handleImport(file: File) {
    if (!pilotId || !user) return;
    setImportBusy(true);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("actorRole", user.role);
      fd.append("isTest", isTest ? "true" : "false");
      const res = await fetch(`/api/outbound/pilots/${pilotId}/leads/import`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setImportMsg({ kind: "err", text: data.error || `Import failed (${res.status})` });
      } else {
        const promptInfo = data.promptsBuilt > 0 ? ` ${data.promptsBuilt} claude_prompt(s) regenerated from current row data + SKILL.md.` : "";
        const skippedInfo = data.skipped > 0 ? ` ${data.skipped} rows skipped (missing domain or person identity).` : "";
        setImportMsg({ kind: "ok", text: `Imported ${data.imported} leads into the ${data.bucket} bucket.${promptInfo}${skippedInfo} Rows with all 3 bodies are marked shippable.` });
        if (onChanged) onChanged();
      }
    } catch (e) {
      setImportMsg({ kind: "err", text: e instanceof Error ? e.message : "Network error" });
    }
    setImportBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function autoGenerateBatch() {
    if (!pilotId || !user) return;
    setAutoBusy(true);
    setAutoMsg(null);
    let cumulativeDone = 0;
    let cumulativeCost = 0;
    try {
      while (true) {
        const res = await fetch(`/api/outbound/pilots/${pilotId}/leads/email/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actorRole: user.role, actorEmail: user.email, limit: 100, concurrency: 5, isTest: !!isTest, onlyWithEmail: true }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAutoMsg({ kind: "err", text: data.error || `Failed (${res.status})` });
          break;
        }
        cumulativeDone += data.succeeded || 0;
        cumulativeCost += data.usdCost || 0;
        setAutoProgress({ done: cumulativeDone, remaining: data.remaining || 0, cost: cumulativeCost });
        if (onChanged) onChanged();
        if ((data.processed || 0) === 0 || (data.remaining || 0) === 0) {
          setAutoMsg({ kind: "ok", text: `Generated ${cumulativeDone} email sequences (only leads with verified/likely emails). Total cost: ~$${cumulativeCost.toFixed(3)}.${data.failed > 0 ? ` ${data.failed} failed in last batch — see paste mode for the holdouts.` : ""} Refresh to see updated Shippable count.` });
          break;
        }
      }
    } catch (e) {
      setAutoMsg({ kind: "err", text: e instanceof Error ? e.message : "Network error" });
    }
    setAutoBusy(false);
  }

  if (pasteMode && pilotId) {
    return (
      <PasteMode
        leads={visible.length > 0 ? visible : leads}
        pilotId={pilotId}
        onClose={() => setPasteMode(false)}
        onChanged={onChanged}
        isTest={!!isTest}
      />
    );
  }

  if (bulkMode && pilotId) {
    return (
      <BulkMode
        leads={visible.length > 0 ? visible : leads}
        pilotId={pilotId}
        onClose={() => setBulkMode(false)}
        onChanged={onChanged}
        isTest={!!isTest}
      />
    );
  }

  if (leads.length === 0) {
    return (
      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }}
        />
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
          <p className="text-sm font-bold text-slate-700">No leads yet</p>
          <p className="text-xs text-slate-500">Either run the stakeholder phase, or import a previously exported XLSX/CSV.</p>
          {pilotId && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6800FF] hover:bg-[#5800DD] disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {importBusy ? <><Loader2 size={13} className="animate-spin" /> Importing…</> : <><Upload size={13} /> Import .xlsx / .csv</>}
            </button>
          )}
        </div>
        {importMsg && (
          <div className={`text-xs rounded-lg px-3 py-2 inline-flex items-start gap-1.5 ${importMsg.kind === "ok" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {importMsg.kind === "ok" ? <Check size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
            <span>{importMsg.text}</span>
          </div>
        )}
      </div>
    );
  }

  if (active) {
    return <LeadDetail lead={active} onBack={() => setActive(null)} pilotId={pilotId} isTest={!!isTest} />;
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search lead, company, contact, observation…"
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15"
          />
        </div>
        <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>All ({leads.length})</FilterTab>
        <FilterTab active={filter === "decisionMakers"} onClick={() => setFilter("decisionMakers")} accent>
          <Crown size={11} className="inline -mt-px mr-1" />
          Founders / CEOs ({decisionMakerCount})
        </FilterTab>
        <FilterTab active={filter === "emailReady"} onClick={() => setFilter("emailReady")}>Email-ready ({emailReadyCount})</FilterTab>
        {recommendedCount > 0 && (
          <FilterTab active={filter === "recommended"} onClick={() => setFilter("recommended")} accent>
            <Sparkles size={11} className="inline -mt-px mr-1" />
            Recommended ({recommendedCount})
          </FilterTab>
        )}
        {skippedCount > 0 && (
          <FilterTab active={filter === "skipped"} onClick={() => setFilter("skipped")}>Skipped ({skippedCount})</FilterTab>
        )}
        <FilterTab active={filter === "shippable"} onClick={() => setFilter("shippable")}>Shippable ({shippableCount})</FilterTab>
        <FilterTab active={filter === "issues"} onClick={() => setFilter("issues")}>Issues ({leads.filter((l) => !l.shippable && l.validationIssues.length > 0).length})</FilterTab>
        {pilotId && (
          <div className="ml-auto flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Upload a previously exported XLSX or CSV to (re)populate leads. Existing claude_prompt cells are kept; missing ones are rebuilt from row data."
            >
              {importBusy ? <><Loader2 size={13} className="animate-spin" /> Importing…</> : <><Upload size={13} /> Import</>}
            </button>
            {emailReadyCount > 0 && (
              <>
                <button
                  onClick={autoGenerateBatch}
                  disabled={autoBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-linear-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white"
                  title={`Auto-generate the 3-email sequence for ${emailReadyCount} email-ready leads via Claude Haiku. Leads without verified/likely emails are skipped.`}
                >
                  {autoBusy
                    ? <><Loader2 size={13} className="animate-spin" /> Generating{autoProgress ? ` · ${autoProgress.done} done · ${autoProgress.remaining} left` : "…"}</>
                    : <><Sparkles size={13} /> Auto-generate ({emailReadyCount})</>}
                </button>
                <button
                  onClick={() => setBulkMode(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700"
                  title="Bulk: copy a batch of prompts in one block, paste into ChatGPT, paste the JSON array response back"
                >
                  <Layers size={13} /> Bulk paste
                </button>
                <button
                  onClick={() => setPasteMode(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#6800FF] text-white hover:bg-[#5800DD]"
                  title="Manual fallback: walk through pending leads, copy prompt → paste Claude JSON → auto-save"
                >
                  <Zap size={13} /> Paste mode
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {importMsg && (
        <div className={`text-xs rounded-lg px-3 py-2 inline-flex items-start gap-1.5 ${importMsg.kind === "ok" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
          {importMsg.kind === "ok" ? <Check size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
          <span>{importMsg.text}</span>
        </div>
      )}

      {autoMsg && (
        <div className={`text-xs rounded-lg px-3 py-2 inline-flex items-start gap-1.5 ${autoMsg.kind === "ok" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
          {autoMsg.kind === "ok" ? <Check size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
          <span>{autoMsg.text}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2">Rank</th>
              <th className="text-left px-3 py-2">Account</th>
              <th className="text-left px-3 py-2">Contact</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Observation</th>
              <th className="text-right px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((l) => {
              const key = `${l.accountDomain}::${l.personKey}`;
              const expanded = expandedKey === key;
              return (
                <React.Fragment key={key}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-3 py-2 tabular-nums text-slate-500 cursor-pointer" onClick={() => setActive(l)}>#{l.rank}</td>
                    <td className="px-3 py-2 cursor-pointer" onClick={() => setActive(l)}>
                      <p className="font-medium text-slate-900 truncate max-w-[180px]">{l.companyShort}</p>
                      <p className="text-[10px] text-slate-400">{l.accountDomain} · score {l.score}</p>
                    </td>
                    <td className="px-3 py-2 cursor-pointer" onClick={() => setActive(l)}>
                      <p className="text-slate-700 truncate max-w-[160px]">{l.fullName || "—"}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{l.contactTitle}</p>
                    </td>
                    <td className="px-3 py-2 cursor-pointer" onClick={() => setActive(l)}>
                      <EmailBadge email={l.email} status={l.emailStatus} />
                    </td>
                    <td className="px-3 py-2 text-slate-600 cursor-pointer" onClick={() => setActive(l)}>
                      <p className="truncate max-w-[280px]">{l.observationAngle || "—"}</p>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (expanded) { setExpandedKey(""); setExpandedFull(null); return; }
                            setExpandedKey(key);
                            setExpandedFull(null);
                            if (pilotId && l.hasPrompt) {
                              setExpandLoading(true);
                              try {
                                const res = await fetch(`/api/outbound/pilots/${pilotId}/leads/full?accountDomain=${encodeURIComponent(l.accountDomain)}&personKey=${encodeURIComponent(l.personKey)}${isTest ? "&test=1" : ""}`);
                                const data = await res.json();
                                if (res.ok && data.lead) {
                                  setExpandedFull({
                                    claudePrompt: data.lead.claudePrompt || "",
                                    subject1: data.lead.subject1 || "", body1: data.lead.body1 || "",
                                    subject2: data.lead.subject2 || "", body2: data.lead.body2 || "",
                                    subject3: data.lead.subject3 || "", body3: data.lead.body3 || "",
                                  });
                                }
                              } catch {}
                              setExpandLoading(false);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded border border-slate-200 hover:bg-slate-50"
                          title="Show prompt + observation inline"
                        >
                          {expanded ? <ChevronLeft size={11} className="rotate-90" /> : <ChevronRight size={11} className="rotate-90" />}
                          {expanded ? "Hide" : "View"}
                        </button>
                        {l.shippable ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <Check size={10} /> ship
                          </span>
                        ) : l.validationIssues.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <AlertTriangle size={10} /> {l.validationIssues.length}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={6} className="px-3 py-3">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Observation angle</p>
                              <p className="text-xs text-slate-800">{l.observationAngle || "(none)"}</p>
                            </div>
                            {l.buyingHypothesis && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">Buying hypothesis · {l.confidenceLevel || "—"} conf · signal {l.buyerSignalScore || 0}/100</p>
                                <p className="text-xs text-slate-800">{l.buyingHypothesis}</p>
                                {l.shouldEmailReason && <p className="text-[10px] text-amber-800 italic mt-1">→ {l.shouldEmailReason}</p>}
                              </div>
                            )}
                            {l.evidenceList && l.evidenceList.length > 0 && (
                              <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Evidence ({l.evidenceList.length})</p>
                                <ul className="space-y-0.5">
                                  {l.evidenceList.map((e, i) => <li key={i} className="text-[10px] text-slate-700 font-mono">· {e}</li>)}
                                </ul>
                              </div>
                            )}
                            {l.topPain && (
                              <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Top pain</p>
                                <p className="text-xs text-slate-700">{l.topPain}</p>
                              </div>
                            )}
                          </div>
                          <div className="bg-white border border-[#6800FF]/30 rounded-lg overflow-hidden">
                            <div className="bg-[#f0e6ff] border-b border-[#6800FF]/20 px-2.5 py-1.5 flex items-center justify-between">
                              <p className="text-[10px] font-bold text-[#6800FF] uppercase tracking-wider">Claude prompt for this lead</p>
                              {expandedFull?.claudePrompt && (
                                <button
                                  onClick={() => navigator.clipboard.writeText(expandedFull.claudePrompt)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[#6800FF] text-white hover:bg-[#5800DD]"
                                >
                                  <Copy size={9} /> Copy
                                </button>
                              )}
                            </div>
                            <pre className="p-2.5 max-h-[280px] overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-700 bg-slate-50">{expandLoading ? "Loading prompt…" : expandedFull?.claudePrompt || (l.hasPrompt ? "(loading)" : "(no prompt — phase 9 hasn't run yet)")}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterTab({ children, active, onClick, accent }: { children: React.ReactNode; active: boolean; onClick: () => void; accent?: boolean }) {
  const activeCls = accent
    ? "bg-amber-500 text-white border-amber-500"
    : "bg-[#6800FF] text-white border-[#6800FF]";
  const idleCls = accent
    ? "bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-300"
    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300";
  return (
    <button onClick={onClick} className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border ${active ? activeCls : idleCls}`}>
      {children}
    </button>
  );
}

function EmailBadge({ email, status }: { email: string; status: string }) {
  if (!email) return <span className="text-[10px] text-slate-400">—</span>;
  const cls =
    status === "verified" ? "text-emerald-700 bg-emerald-50" :
    status === "likely_to_engage" ? "text-amber-700 bg-amber-50" :
    "text-slate-500 bg-slate-50";
  return (
    <div className="flex items-center gap-1">
      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}>{status.replace(/_/g, " ")}</span>
      <code className="text-[10px] font-mono text-slate-600 truncate max-w-[150px]">{email}</code>
    </div>
  );
}

function LeadDetail({ lead, onBack, pilotId, isTest }: { lead: PilotLeadRow; onBack: () => void; pilotId?: string; isTest?: boolean }) {
  const [full, setFull] = useState<{ claudePrompt: string; subject1: string; body1: string; subject2: string; body2: string; subject3: string; body3: string } | null>(null);
  useEffect(() => {
    if (!pilotId || !lead.accountDomain || !lead.personKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/outbound/pilots/${pilotId}/leads/full?accountDomain=${encodeURIComponent(lead.accountDomain)}&personKey=${encodeURIComponent(lead.personKey)}${isTest ? "&test=1" : ""}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.lead) return;
        setFull({
          claudePrompt: data.lead.claudePrompt || "",
          subject1: data.lead.subject1 || "", body1: data.lead.body1 || "",
          subject2: data.lead.subject2 || "", body2: data.lead.body2 || "",
          subject3: data.lead.subject3 || "", body3: data.lead.body3 || "",
        });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [pilotId, isTest, lead.accountDomain, lead.personKey]);

  const cp = full?.claudePrompt ?? lead.claudePrompt ?? "";
  const s1 = full?.subject1 ?? lead.subject1 ?? "";
  const b1 = full?.body1 ?? lead.body1 ?? "";
  const s2 = full?.subject2 ?? lead.subject2 ?? "";
  const b2 = full?.body2 ?? lead.body2 ?? "";
  const s3 = full?.subject3 ?? lead.subject3 ?? "";
  const b3 = full?.body3 ?? lead.body3 ?? "";
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#6800FF]">
        <ChevronRight size={13} className="rotate-180" /> Back to leads
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{lead.companyShort}</h2>
            <p className="text-xs text-slate-500">{lead.accountDomain} · {lead.industry} · score {lead.score}</p>
            <p className="text-sm text-slate-700 mt-2">{lead.fullName} <span className="text-slate-400">·</span> {lead.contactTitle}</p>
            <div className="mt-1"><EmailBadge email={lead.email} status={lead.emailStatus} /></div>
          </div>
          {lead.shippable ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
              <Check size={12} /> Shippable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-1 rounded">
              <AlertTriangle size={12} /> {lead.validationIssues.length} issue{lead.validationIssues.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {lead.observationAngle && (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Observation angle</p>
            <p className="text-xs text-slate-700 mt-0.5">{lead.observationAngle}</p>
          </div>
        )}

        {(lead.buyingHypothesis || lead.shouldEmail || (lead.evidenceList && lead.evidenceList.length > 0)) && (
          <div className="mt-3 bg-linear-to-br from-amber-50 to-white border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider inline-flex items-center gap-1.5">
                <Sparkles size={11} /> Intelligence layer
              </p>
              <div className="inline-flex items-center gap-1.5">
                {lead.shouldEmail && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${lead.shouldEmail === "yes" ? "bg-emerald-100 text-emerald-800" : lead.shouldEmail === "maybe" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                    {lead.shouldEmail === "yes" ? "✓ email" : lead.shouldEmail === "maybe" ? "~ maybe" : "✕ skip"}
                  </span>
                )}
                {lead.confidenceLevel && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{lead.confidenceLevel} conf</span>
                )}
                {(lead.buyerSignalScore ?? 0) > 0 && (
                  <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded bg-[#f0e6ff] text-[#6800FF]">signal {lead.buyerSignalScore}/100</span>
                )}
              </div>
            </div>
            {lead.buyingHypothesis && (
              <div className="bg-white border border-amber-200/70 rounded p-2.5">
                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-0.5">Buying hypothesis</p>
                <p className="text-[12px] text-slate-800 leading-relaxed">{lead.buyingHypothesis}</p>
              </div>
            )}
            {lead.shouldEmailReason && (
              <p className="text-[11px] text-amber-900/80 italic">→ {lead.shouldEmailReason}</p>
            )}
            {lead.evidenceList && lead.evidenceList.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1">Evidence ({lead.evidenceList.length})</p>
                <ul className="space-y-0.5">
                  {lead.evidenceList.map((e, i) => <li key={i} className="text-[11px] text-slate-700 font-mono">· {e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {(lead.theirCustomers || lead.topPain || lead.valueAngle) && (
          <div className="mt-3 bg-linear-to-br from-[#f8f5ff] to-white border border-[#6800FF]/20 rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-bold text-[#6800FF] uppercase tracking-wider">Per-lead research (the brain)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {lead.whatTheySell && <Block label="What they sell" value={lead.whatTheySell} />}
              {lead.theirCustomers && <Block label="Their customers" value={lead.theirCustomers} />}
              {lead.theirStage && <Block label="Their stage" value={lead.theirStage} />}
              {lead.subjectTopic && <Block label="Subject topic" value={lead.subjectTopic} />}
              {lead.topPain && <Block label="Top pain" value={lead.topPain} wide />}
              {lead.valueAngle && <Block label="Value angle (why VWO)" value={lead.valueAngle} wide />}
              {lead.socialProofMatch && lead.socialProofMatch.length > 0 && (
                <Block label="Matched social proof" value={lead.socialProofMatch.join(" · ")} wide />
              )}
            </div>
          </div>
        )}
      </div>

      {!lead.shippable && lead.validationIssues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <p className="text-xs font-bold text-amber-800 mb-2 inline-flex items-center gap-1">
            <AlertTriangle size={12} /> Validation issues ({lead.validationIssues.length})
          </p>
          <ul className="space-y-0.5 text-[11px] text-amber-900 font-mono">
            {lead.validationIssues.map((iss, i) => (<li key={i}>· {iss}</li>))}
          </ul>
        </div>
      )}

      {cp ? (
        <ClaudePromptCard prompt={cp} />
      ) : (lead.hasFullSequence || b1 || b2 || b3) ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <BodyCard step={1} subject={s1} body={b1} />
          <BodyCard step={2} subject={s2} body={b2} />
          <BodyCard step={3} subject={s3} body={b3} />
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">Loading…</p>
      )}
    </div>
  );
}

function ClaudePromptCard({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }
  return (
    <div className="bg-white rounded-2xl border border-[#6800FF]/30 ring-1 ring-[#6800FF]/10 overflow-hidden">
      <div className="bg-[#f0e6ff] border-b border-[#6800FF]/20 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-bold text-[#6800FF] inline-flex items-center gap-1.5">
            <Mail size={12} /> Claude prompt for this lead
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Paste into a new chat in your Claude Project (with the Project Instructions loaded). Claude returns the JSON sequence.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={copy} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${copied ? "bg-emerald-600 text-white" : "bg-[#6800FF] hover:bg-[#5800DD] text-white"}`}>
            {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
          </button>
          <a href="https://claude.ai/projects" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold">
            <ExternalLink size={11} /> Open Claude
          </a>
        </div>
      </div>
      <pre className="p-3 max-h-[480px] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-800 bg-slate-50">{prompt}</pre>
    </div>
  );
}

function PasteMode({ leads, pilotId, onClose, onChanged, isTest }: { leads: PilotLeadRow[]; pilotId: string; onClose: () => void; onChanged?: () => void; isTest?: boolean }) {
  const queue = useMemo(() => leads.filter((l) => (l.hasPrompt ?? !!l.claudePrompt)), [leads]);
  const [idx, setIdx] = useState(() => {
    const firstPending = queue.findIndex(isPending);
    return firstPending >= 0 ? firstPending : 0;
  });
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [savedAt, setSavedAt] = useState<number>(0);
  const [promptCopied, setPromptCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const lead = queue[idx];
  const [fullPrompt, setFullPrompt] = useState<string>("");
  const [fullBodies, setFullBodies] = useState<{ subject1: string; body1: string; subject2: string; body2: string; subject3: string; body3: string } | null>(null);

  useEffect(() => {
    setPromptCopied(false);
    setFullPrompt("");
    setFullBodies(null);
    if (!lead?.accountDomain || !lead?.personKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/outbound/pilots/${pilotId}/leads/full?accountDomain=${encodeURIComponent(lead.accountDomain)}&personKey=${encodeURIComponent(lead.personKey)}${isTest ? "&test=1" : ""}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.lead) return;
        setFullPrompt(data.lead.claudePrompt || "");
        setFullBodies({
          subject1: data.lead.subject1 || "", body1: data.lead.body1 || "",
          subject2: data.lead.subject2 || "", body2: data.lead.body2 || "",
          subject3: data.lead.subject3 || "", body3: data.lead.body3 || "",
        });
        if (data.lead.claudePrompt) {
          navigator.clipboard.writeText(data.lead.claudePrompt).then(() => {
            if (!cancelled) setPromptCopied(true);
          }).catch(() => {});
        }
      } catch {}
    })();
    textareaRef.current?.focus();
    return () => { cancelled = true; };
  }, [idx, lead?.accountDomain, lead?.personKey, pilotId, isTest]);

  function navigateTo(newIdx: number) {
    setIdx(newIdx);
    setRaw("");
    setErr("");
  }
  function next() {
    if (idx < queue.length - 1) navigateTo(idx + 1);
  }
  function prev() {
    if (idx > 0) navigateTo(idx - 1);
  }
  function jumpToNextPending() {
    for (let i = idx + 1; i < queue.length; i++) {
      if (isPending(queue[i])) { navigateTo(i); return; }
    }
    for (let i = 0; i < idx; i++) {
      if (isPending(queue[i])) { navigateTo(i); return; }
    }
  }
  function jumpToRank(rawRank: string): { ok: boolean; reason?: string } {
    const n = Number(rawRank);
    if (!Number.isFinite(n) || n < 1) return { ok: false, reason: "Enter a positive number" };
    const byRank = queue.findIndex((l) => l.rank === n);
    if (byRank >= 0) { navigateTo(byRank); return { ok: true }; }
    const byPosition = Math.floor(n) - 1;
    if (byPosition >= 0 && byPosition < queue.length) { navigateTo(byPosition); return { ok: true }; }
    return { ok: false, reason: `Lead #${n} not in this queue (queue size: ${queue.length})` };
  }

  async function save() {
    if (!lead) return;
    if (!raw.trim()) { setErr("Paste Claude's JSON response first."); return; }
    setBusy(true);
    setErr("");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}/leads/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountDomain: lead.accountDomain, personKey: lead.personKey, raw, isTest: !!isTest }),
        signal: controller.signal,
      });
      let data: { error?: string; fields?: { subject1: string; body1: string; subject2: string; body2: string; subject3: string; body3: string }; shippable?: boolean } = {};
      try { data = await res.json(); }
      catch { data = { error: `Server returned ${res.status} with non-JSON body` }; }
      if (!res.ok) {
        setErr(data.error || `Save failed (${res.status})`);
        return;
      }
      if (!data.fields) {
        setErr("Server returned 200 but no fields — possible parsing issue. Try again.");
        return;
      }
      lead.subject1 = data.fields.subject1;
      lead.body1 = data.fields.body1;
      lead.subject2 = data.fields.subject2;
      lead.body2 = data.fields.body2;
      lead.subject3 = data.fields.subject3;
      lead.body3 = data.fields.body3;
      lead.shippable = !!data.shippable;
      setSavedAt(Date.now());
      if (onChanged) onChanged();
      await new Promise((r) => setTimeout(r, 350));
      if (idx < queue.length - 1) {
        navigateTo(idx + 1);
      } else {
        setRaw("");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setErr("Save timed out after 30s. Check your network or server logs and try again.");
      } else {
        setErr(e instanceof Error ? e.message : "Network error");
      }
    } finally {
      clearTimeout(timeoutId);
      setBusy(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); }
  }

  if (queue.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <p className="text-sm font-bold text-slate-700">No leads with Claude prompts</p>
        <p className="text-xs text-slate-500">Run the draft phase first to generate prompts.</p>
        <button onClick={onClose} className="text-xs font-medium text-[#6800FF] hover:underline">Back</button>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <p className="text-sm font-bold text-slate-700">No lead at this index.</p>
        <button onClick={onClose} className="text-xs font-medium text-[#6800FF] hover:underline">Back</button>
      </div>
    );
  }

  const pendingRemaining = queue.filter(isPending).length;
  const flashSaved = savedAt > 0 && Date.now() - savedAt < 1500;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
            <X size={13} /> Close
          </button>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6800FF] bg-[#f0e6ff] px-2 py-0.5 rounded">Paste mode</span>
          <span className="text-[11px] text-slate-500 tabular-nums">
            Lead {idx + 1} / {queue.length} · #{lead?.rank ?? "—"} · {pendingRemaining} pending
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <JumpToRank queueLength={queue.length} onJump={jumpToRank} />
          <button onClick={prev} disabled={idx === 0} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-slate-200 bg-white hover:border-slate-300 disabled:opacity-40">
            <ChevronLeft size={12} /> Prev
          </button>
          <button onClick={jumpToNextPending} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-slate-200 bg-white hover:border-slate-300">
            Skip to next pending <ChevronRight size={12} />
          </button>
          <button onClick={next} disabled={idx >= queue.length - 1} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-slate-200 bg-white hover:border-slate-300 disabled:opacity-40">
            Next <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-bold text-slate-900">{lead.companyShort} <span className="text-slate-300">·</span> <span className="text-slate-700 font-semibold">{lead.fullName || "—"}</span></p>
            <p className="text-[11px] text-slate-500">{lead.accountDomain} · {lead.contactTitle || "—"} · score {lead.score}</p>
          </div>
          <EmailBadge email={lead.email} status={lead.emailStatus} />
        </div>
        {lead.observationAngle && (
          <p className="text-[11px] text-slate-600 mt-2 italic">"{lead.observationAngle}"</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-[#6800FF]/30 ring-1 ring-[#6800FF]/10 overflow-hidden">
          <div className="bg-[#f0e6ff] border-b border-[#6800FF]/20 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-bold text-[#6800FF] inline-flex items-center gap-1.5">
              <Mail size={12} /> Step 1 — Copy this prompt
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { navigator.clipboard.writeText(fullPrompt || "").then(() => setPromptCopied(true)); }} disabled={!fullPrompt} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold disabled:opacity-50 ${promptCopied ? "bg-emerald-600 text-white" : "bg-[#6800FF] text-white hover:bg-[#5800DD]"}`}>
                {promptCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy prompt</>}
              </button>
              <a href="https://claude.ai/projects" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold">
                <ExternalLink size={11} /> Claude
              </a>
            </div>
          </div>
          <pre className="p-3 max-h-[420px] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-800 bg-slate-50">{fullPrompt || (lead.hasPrompt ? "Loading prompt…" : "(no prompt for this lead)")}</pre>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-300 ring-1 ring-emerald-100 overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-bold text-emerald-800 inline-flex items-center gap-1.5">
              <Zap size={12} /> Step 2 — Paste Claude's JSON here
            </p>
            <span className="text-[10px] text-emerald-700/70">⌘↵ to save & advance · use Next / Prev buttons to navigate</span>
          </div>
          <textarea
            ref={textareaRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={onKey}
            placeholder='{"subject_1":"...","body_1":"...","subject_2":"...","body_2":"...","subject_3":"...","body_3":"..."}'
            className="w-full p-3 h-[260px] font-mono text-[11px] leading-relaxed text-slate-800 bg-white focus:outline-none resize-none"
          />
          <div className="border-t border-emerald-200 bg-white px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[11px] min-h-[16px]">
              {err && <span className="text-red-700 font-medium">{err}</span>}
              {!err && flashSaved && <span className="text-emerald-700 font-medium inline-flex items-center gap-1"><Check size={11} /> Saved → advancing…</span>}
              {!err && !flashSaved && lead.hasFullSequence && <span className="text-slate-500">Already drafted (saving will overwrite)</span>}
            </div>
            <button
              onClick={save}
              disabled={busy || !raw.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {busy ? "Saving…" : <>Save & next <ChevronRight size={12} /></>}
            </button>
          </div>
        </div>
      </div>

      {fullBodies && (fullBodies.body1 || fullBodies.body2 || fullBodies.body3) && (
        <details className="bg-white rounded-2xl border border-slate-200 p-3">
          <summary className="text-xs font-bold text-slate-700 cursor-pointer">Current saved drafts (click to preview)</summary>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-3">
            <BodyCard step={1} subject={fullBodies.subject1} body={fullBodies.body1} />
            <BodyCard step={2} subject={fullBodies.subject2} body={fullBodies.body2} />
            <BodyCard step={3} subject={fullBodies.subject3} body={fullBodies.body3} />
          </div>
        </details>
      )}
    </div>
  );
}

function BulkMode({ leads, pilotId, onClose, onChanged, isTest }: { leads: PilotLeadRow[]; pilotId: string; onClose: () => void; onChanged?: () => void; isTest?: boolean }) {
  const queue = useMemo(() => leads.filter((l) => (l.hasPrompt ?? !!l.claudePrompt) && isPending(l) && hasUsableEmail(l)), [leads]);
  const [batchSize, setBatchSize] = useState(20);
  const [batchStart, setBatchStart] = useState(0);
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [exportCopied, setExportCopied] = useState(false);
  const [batchPrompts, setBatchPrompts] = useState<Map<string, string>>(new Map());
  const [loadingBatch, setLoadingBatch] = useState(false);

  const batch = useMemo(() => queue.slice(batchStart, batchStart + batchSize), [queue, batchStart, batchSize]);

  useEffect(() => {
    if (batch.length === 0) return;
    let cancelled = false;
    setLoadingBatch(true);
    (async () => {
      const keys = batch.map((l) => `${l.accountDomain}::${l.personKey}`).join(",");
      try {
        const res = await fetch(`/api/outbound/pilots/${pilotId}/leads/full?keys=${encodeURIComponent(keys)}${isTest ? "&test=1" : ""}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const l of (data.leads || []) as Array<{ accountDomain: string; personKey: string; claudePrompt: string }>) {
          map.set(`${l.accountDomain}::${l.personKey}`, l.claudePrompt || "");
        }
        setBatchPrompts(map);
      } catch {}
      if (!cancelled) setLoadingBatch(false);
    })();
    return () => { cancelled = true; };
  }, [batch, pilotId, isTest]);

  const exportText = useMemo(() => {
    if (batch.length === 0) return "";
    const lines: string[] = [];
    lines.push(`INSTRUCTIONS: For each lead block below, generate a 3-email sequence following the SKILL rules in your project instructions.`);
    lines.push(`Return ONE valid JSON array (no markdown fences, no preamble). Each item must have these exact keys:`);
    lines.push(`  email, firstName, lastName, personKey (echo input as-is), subject_1, body_1, subject_2, body_2, subject_3, body_3`);
    lines.push(``);
    lines.push(`Output schema:`);
    lines.push(`[`);
    lines.push(`  { "email": "...", "firstName": "...", "lastName": "...", "personKey": "...", "subject_1": "...", "body_1": "...", "subject_2": "...", "body_2": "...", "subject_3": "...", "body_3": "..." },`);
    lines.push(`  ...`);
    lines.push(`]`);
    lines.push(``);
    lines.push(`Output ${batch.length} items, one per lead, in the same order as the prompts below.`);
    lines.push(``);
    for (let i = 0; i < batch.length; i++) {
      const l = batch[i];
      const fullPrompt = batchPrompts.get(`${l.accountDomain}::${l.personKey}`) || l.claudePrompt || "";
      lines.push(`========== LEAD ${i + 1} of ${batch.length} ==========`);
      lines.push(`email: ${l.email}`);
      lines.push(`firstName: ${l.fullName.split(" ")[0] || ""}`);
      lines.push(`lastName: ${l.fullName.split(" ").slice(1).join(" ") || ""}`);
      lines.push(`personKey: ${l.personKey}`);
      lines.push(``);
      lines.push(fullPrompt);
      lines.push(``);
    }
    return lines.join("\n");
  }, [batch, batchPrompts]);

  function copyExport() {
    navigator.clipboard.writeText(exportText).then(() => {
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 1800);
    }).catch(() => {});
  }

  function stripFences(s: string): string {
    let t = s.trim();
    t = t.replace(/^```(?:json)?\s*/i, "");
    t = t.replace(/```\s*$/i, "");
    return t.trim();
  }

  function extractFirstArray(s: string): string {
    const start = s.indexOf("[");
    const end = s.lastIndexOf("]");
    if (start >= 0 && end > start) return s.slice(start, end + 1);
    return s;
  }

  async function saveBulk() {
    if (!response.trim()) { setMsg({ kind: "err", text: "Paste ChatGPT's JSON array response first." }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const cleaned = extractFirstArray(stripFences(response));
      let parsed: unknown;
      try { parsed = JSON.parse(cleaned); }
      catch (e) {
        setMsg({ kind: "err", text: `Could not parse JSON: ${e instanceof Error ? e.message : "unknown"}` });
        setBusy(false);
        return;
      }
      if (!Array.isArray(parsed)) {
        setMsg({ kind: "err", text: "Expected a JSON array (got an object). Wrap items in [ ... ]." });
        setBusy(false);
        return;
      }
      const res = await fetch(`/api/outbound/pilots/${pilotId}/leads/email/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: "admin", isTest: !!isTest, results: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error || `Bulk save failed (${res.status})` });
        setBusy(false);
        return;
      }
      const matchedBy = data.matchedBy || {};
      setMsg({
        kind: "ok",
        text: `Saved ${data.matched}/${data.totalReceived} leads. Matched by personKey ${matchedBy.personKey || 0}, email ${matchedBy.email || 0}, name+domain ${matchedBy.nameDomain || 0}. Unmatched: ${data.unmatched}. Incomplete: ${data.incomplete}.`,
      });
      setResponse("");
      if (onChanged) onChanged();
      const nextStart = batchStart + batchSize;
      if (nextStart < queue.length) setBatchStart(nextStart);
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Network error" });
    }
    setBusy(false);
  }

  if (queue.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <Layers size={20} className="mx-auto text-slate-300" />
        <p className="text-sm font-bold text-slate-700">No leads need bulk drafting</p>
        <p className="text-xs text-slate-500">Bulk mode shows leads with prompts + verified emails but no body sequence yet.</p>
        <button onClick={onClose} className="text-xs font-medium text-[#6800FF] hover:underline">Back</button>
      </div>
    );
  }

  const remaining = queue.length - batchStart;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onClose} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
            <X size={13} /> Close
          </button>
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded">Bulk paste</span>
          <span className="text-[11px] text-slate-500 tabular-nums">
            Batch {batch.length > 0 ? `${batchStart + 1}–${batchStart + batch.length}` : "—"} of {queue.length} pending · {remaining} remaining
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
            Batch size
            <input
              type="number"
              min={1}
              max={50}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(1, Math.min(50, Number(e.target.value) || 20)))}
              className="w-14 px-1.5 py-1 border border-slate-200 rounded text-xs tabular-nums focus:outline-none focus:border-sky-500"
            />
          </label>
          <button
            onClick={() => setBatchStart(Math.max(0, batchStart - batchSize))}
            disabled={batchStart === 0 || busy}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-slate-200 bg-white hover:border-slate-300 disabled:opacity-40"
          >
            <ChevronLeft size={12} /> Prev batch
          </button>
          <button
            onClick={() => setBatchStart(Math.min(queue.length - 1, batchStart + batchSize))}
            disabled={batchStart + batchSize >= queue.length || busy}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-slate-200 bg-white hover:border-slate-300 disabled:opacity-40"
          >
            Next batch <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-sky-300 ring-1 ring-sky-100 overflow-hidden">
          <div className="bg-sky-50 border-b border-sky-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-bold text-sky-800 inline-flex items-center gap-1.5">
              <Mail size={12} /> Step 1 — Copy and paste this batch into ChatGPT
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={copyExport} disabled={loadingBatch} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold disabled:opacity-50 ${exportCopied ? "bg-emerald-600 text-white" : "bg-sky-600 text-white hover:bg-sky-700"}`}>
                {exportCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy {batch.length} prompts</>}
              </button>
              <a href="https://chat.openai.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold">
                <ExternalLink size={11} /> ChatGPT
              </a>
            </div>
          </div>
          <pre className="p-3 max-h-[420px] overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-700 bg-slate-50">{exportText.slice(0, 4000)}{exportText.length > 4000 ? `\n\n…(${exportText.length.toLocaleString()} chars total — full text is in your clipboard after Copy)` : ""}</pre>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-300 ring-1 ring-emerald-100 overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-bold text-emerald-800 inline-flex items-center gap-1.5">
              <Zap size={12} /> Step 2 — Paste ChatGPT's JSON array here
            </p>
            <span className="text-[10px] text-emerald-700/70">expects [...] with {batch.length} items</span>
          </div>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder='[{"email":"...","firstName":"...","lastName":"...","personKey":"...","subject_1":"...","body_1":"...","subject_2":"...","body_2":"...","subject_3":"...","body_3":"..."}, ...]'
            className="w-full p-3 h-[260px] font-mono text-[11px] leading-relaxed text-slate-800 bg-white focus:outline-none resize-none"
          />
          <div className="border-t border-emerald-200 bg-white px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[11px] min-h-[16px]">
              {msg && (
                <span className={msg.kind === "ok" ? "text-emerald-700 font-medium inline-flex items-center gap-1" : "text-red-700 font-medium inline-flex items-center gap-1"}>
                  {msg.kind === "ok" ? <Check size={11} /> : <AlertTriangle size={11} />}
                  {msg.text}
                </span>
              )}
            </div>
            <button
              onClick={saveBulk}
              disabled={busy || !response.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {busy ? <><Loader2 size={11} className="animate-spin" /> Saving…</> : <>Parse &amp; save {batch.length} leads <ChevronRight size={12} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JumpToRank({ queueLength, onJump }: { queueLength: number; onJump: (raw: string) => { ok: boolean; reason?: string } }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  function go() {
    if (!val.trim()) return;
    const r = onJump(val.trim());
    if (!r.ok) { setErr(r.reason || "not found"); return; }
    setErr("");
    setVal("");
  }
  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-[10px] text-slate-400">Jump #</span>
      <input
        type="number"
        min={1}
        max={queueLength}
        value={val}
        onChange={(e) => { setVal(e.target.value); setErr(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }}
        placeholder="715"
        className="w-16 px-1.5 py-1 border border-slate-200 rounded text-xs tabular-nums focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15"
      />
      <button onClick={go} disabled={!val.trim()} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[#6800FF] hover:bg-[#5800DD] disabled:opacity-40 text-white font-semibold">
        Go
      </button>
      {err && <span className="text-[10px] text-red-700 ml-1">{err}</span>}
    </div>
  );
}

function Block({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`bg-white border border-slate-200 rounded px-2.5 py-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-[11px] text-slate-700 mt-0.5">{value}</p>
    </div>
  );
}

function BodyCard({ step, subject, body }: { step: number; subject: string; body: string }) {
  const wc = (body || "").split(/\s+/).filter(Boolean).length;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
          <Mail size={12} className="text-[#6800FF]" />
          Step {step}
        </p>
        <span className="text-[10px] tabular-nums text-slate-500">{wc} words</span>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subject</p>
          <p className="text-sm font-mono text-slate-900 mt-0.5 break-all">{subject || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Body</p>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap mt-0.5">{body || "—"}</p>
        </div>
      </div>
    </div>
  );
}
