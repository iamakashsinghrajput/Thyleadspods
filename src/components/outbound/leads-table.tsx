"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Mail, Check, AlertTriangle, ChevronRight, ChevronLeft, Copy, ExternalLink, Crown, Zap, X } from "lucide-react";
import type { PilotLeadRow } from "./types";

type LeadFilter = "all" | "decisionMakers" | "shippable" | "issues";

const DECISION_MAKER_TITLE_RE = /\b(founder|co[- ]?founder|cofounder|ceo|chief executive)\b/i;

function isDecisionMaker(l: PilotLeadRow): boolean {
  return DECISION_MAKER_TITLE_RE.test(l.contactTitle || "");
}

function isPending(l: PilotLeadRow): boolean {
  if (!l.claudePrompt) return false;
  return !(l.body1 && l.body2 && l.body3);
}

export default function LeadsTable({ leads, pilotId, onChanged }: { leads: PilotLeadRow[]; pilotId?: string; onChanged?: () => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [active, setActive] = useState<PilotLeadRow | null>(null);
  const [pasteMode, setPasteMode] = useState(false);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (filter === "shippable" && !l.shippable) return false;
      if (filter === "issues" && (l.shippable || l.validationIssues.length === 0)) return false;
      if (filter === "decisionMakers" && !isDecisionMaker(l)) return false;
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

  if (pasteMode && pilotId) {
    return (
      <PasteMode
        leads={visible.length > 0 ? visible : leads}
        pilotId={pilotId}
        onClose={() => setPasteMode(false)}
        onChanged={onChanged}
      />
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
        <p className="text-sm font-bold text-slate-700">No leads yet</p>
        <p className="text-xs text-slate-500 mt-1">Run the stakeholder phase to populate leads.</p>
      </div>
    );
  }

  if (active) {
    return <LeadDetail lead={active} onBack={() => setActive(null)} />;
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
        <FilterTab active={filter === "shippable"} onClick={() => setFilter("shippable")}>Shippable ({leads.filter((l) => l.shippable).length})</FilterTab>
        <FilterTab active={filter === "issues"} onClick={() => setFilter("issues")}>Issues ({leads.filter((l) => !l.shippable && l.validationIssues.length > 0).length})</FilterTab>
        {pilotId && pendingCount > 0 && (
          <button
            onClick={() => setPasteMode(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#6800FF] text-white hover:bg-[#5800DD]"
            title="Walk through pending leads, copy prompt → paste Claude JSON → auto-save"
          >
            <Zap size={13} /> Paste mode ({pendingCount} pending)
          </button>
        )}
      </div>

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
            {visible.map((l) => (
              <tr key={`${l.accountDomain}::${l.personKey}`} onClick={() => setActive(l)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-3 py-2 tabular-nums text-slate-500">#{l.rank}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-900 truncate max-w-[180px]">{l.companyShort}</p>
                  <p className="text-[10px] text-slate-400">{l.accountDomain} · score {l.score}</p>
                </td>
                <td className="px-3 py-2">
                  <p className="text-slate-700 truncate max-w-[160px]">{l.fullName || "—"}</p>
                  <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{l.contactTitle}</p>
                </td>
                <td className="px-3 py-2">
                  <EmailBadge email={l.email} status={l.emailStatus} />
                </td>
                <td className="px-3 py-2 text-slate-600">
                  <p className="truncate max-w-[280px]">{l.observationAngle || "—"}</p>
                </td>
                <td className="px-3 py-2 text-right">
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
                </td>
              </tr>
            ))}
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

function LeadDetail({ lead, onBack }: { lead: PilotLeadRow; onBack: () => void }) {
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

      {lead.claudePrompt && lead.claudePrompt.length > 0 ? (
        <ClaudePromptCard prompt={lead.claudePrompt} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <BodyCard step={1} subject={lead.subject1} body={lead.body1} />
          <BodyCard step={2} subject={lead.subject2} body={lead.body2} />
          <BodyCard step={3} subject={lead.subject3} body={lead.body3} />
        </div>
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

function PasteMode({ leads, pilotId, onClose, onChanged }: { leads: PilotLeadRow[]; pilotId: string; onClose: () => void; onChanged?: () => void }) {
  const queue = useMemo(() => leads.filter((l) => l.claudePrompt), [leads]);
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

  useEffect(() => {
    setRaw("");
    setErr("");
    setPromptCopied(false);
    if (lead?.claudePrompt) {
      navigator.clipboard.writeText(lead.claudePrompt).then(() => {
        setPromptCopied(true);
      }).catch(() => {});
    }
    textareaRef.current?.focus();
  }, [idx, lead?.accountDomain, lead?.personKey, lead?.claudePrompt]);

  function next() {
    if (idx < queue.length - 1) setIdx(idx + 1);
  }
  function prev() {
    if (idx > 0) setIdx(idx - 1);
  }
  function jumpToNextPending() {
    for (let i = idx + 1; i < queue.length; i++) {
      if (isPending(queue[i])) { setIdx(i); return; }
    }
    for (let i = 0; i < idx; i++) {
      if (isPending(queue[i])) { setIdx(i); return; }
    }
  }

  async function save() {
    if (!lead) return;
    if (!raw.trim()) { setErr("Paste Claude's JSON response first."); return; }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}/leads/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountDomain: lead.accountDomain, personKey: lead.personKey, raw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Save failed");
        setBusy(false);
        return;
      }
      lead.subject1 = data.fields.subject1;
      lead.body1 = data.fields.body1;
      lead.subject2 = data.fields.subject2;
      lead.body2 = data.fields.body2;
      lead.subject3 = data.fields.subject3;
      lead.body3 = data.fields.body3;
      lead.shippable = true;
      setSavedAt(Date.now());
      setRaw("");
      jumpToNextPending();
      if (onChanged) onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    }
    setBusy(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); }
    else if ((e.metaKey || e.ctrlKey) && e.key === "ArrowRight") { e.preventDefault(); next(); }
    else if ((e.metaKey || e.ctrlKey) && e.key === "ArrowLeft") { e.preventDefault(); prev(); }
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
            Lead {idx + 1} / {queue.length} · {pendingRemaining} pending
          </span>
        </div>
        <div className="flex items-center gap-1.5">
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
              <button onClick={() => { navigator.clipboard.writeText(lead.claudePrompt || "").then(() => setPromptCopied(true)); }} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${promptCopied ? "bg-emerald-600 text-white" : "bg-[#6800FF] text-white hover:bg-[#5800DD]"}`}>
                {promptCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy prompt</>}
              </button>
              <a href="https://claude.ai/projects" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold">
                <ExternalLink size={11} /> Claude
              </a>
            </div>
          </div>
          <pre className="p-3 max-h-[420px] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-800 bg-slate-50">{lead.claudePrompt}</pre>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-300 ring-1 ring-emerald-100 overflow-hidden">
          <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-bold text-emerald-800 inline-flex items-center gap-1.5">
              <Zap size={12} /> Step 2 — Paste Claude's JSON here
            </p>
            <span className="text-[10px] text-emerald-700/70">⌘↵ to save · ⌘→ next</span>
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
              {!err && flashSaved && <span className="text-emerald-700 font-medium inline-flex items-center gap-1"><Check size={11} /> Saved · advanced</span>}
              {!err && !flashSaved && lead.body1 && <span className="text-slate-500">Already drafted (saving will overwrite)</span>}
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

      {(lead.body1 || lead.body2 || lead.body3) && (
        <details className="bg-white rounded-2xl border border-slate-200 p-3">
          <summary className="text-xs font-bold text-slate-700 cursor-pointer">Current saved drafts (click to preview)</summary>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mt-3">
            <BodyCard step={1} subject={lead.subject1} body={lead.body1} />
            <BodyCard step={2} subject={lead.subject2} body={lead.body2} />
            <BodyCard step={3} subject={lead.subject3} body={lead.body3} />
          </div>
        </details>
      )}
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
