"use client";

import { useEffect, useState } from "react";
import {
  Loader2, X, Check, Mail, Send, Copy, ChevronDown, ChevronRight,
  Sparkles, Building2, FileText, Inbox, Trash2, ShieldCheck, AlertTriangle,
  Globe, Link as LinkIcon, RefreshCw, Upload, Bot, Search, TrendingUp, Target, Wand2,
  Play, Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { STAGES, STAGE_ORDER, stageIndex, type ClientStatus } from "@/lib/onboarding/stages";
import { ONBOARDING_FIELDS, type OnboardingFieldDef } from "@/lib/onboarding/form-fields";
import type { OnboardingClientDoc, OnboardingAccountDoc, OnboardingContactDoc } from "./types";

const STAGE_TONE: Record<ClientStatus, string> = {
  new_client: "bg-slate-100 text-slate-700 border-slate-200",
  form_pending: "bg-amber-50 text-amber-700 border-amber-200",
  form_received: "bg-blue-50 text-blue-700 border-blue-200",
  accounts_in_progress: "bg-purple-50 text-purple-700 border-purple-200",
  awaiting_approval: "bg-orange-50 text-orange-700 border-orange-200",
  data_team_extracting: "bg-indigo-50 text-indigo-700 border-indigo-200",
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

interface Props {
  client: OnboardingClientDoc;
  onChanged: () => void;
}

export default function ClientCard({ client, onChanged }: Props) {
  const { user } = useAuth();
  const canEdit = user?.role === "superadmin" || user?.role === "admin";
  const [expanded, setExpanded] = useState(false);
  const stage = STAGES.find((s) => s.key === client.status);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-4 sm:px-5 py-4 flex items-center gap-3 text-left hover:bg-slate-50/40 transition-colors">
        {expanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm sm:text-base font-bold text-slate-900">{client.name}</p>
            <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${STAGE_TONE[client.status]}`}>
              {stage?.label}
            </span>
            {client.contactEmail && <span className="text-[11px] text-slate-400">{client.contactEmail}</span>}
          </div>
          {stage && <p className="text-[11px] text-slate-500 mt-1">{stage.description}</p>}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 sm:p-5 bg-slate-50/40 space-y-4">
          <JourneyBar status={client.status} />
          <NextActionCallout client={client} />
          <ClientMeta client={client} onChanged={onChanged} canEdit={canEdit} />
          <StagePanel client={client} onChanged={onChanged} canEdit={canEdit} />
          {canEdit && <DangerZone client={client} onChanged={onChanged} />}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY BAR — visual timeline of all 7 stages with current highlighted
// ─────────────────────────────────────────────────────────────────────────────
function JourneyBar({ status }: { status: ClientStatus }) {
  const currentIdx = stageIndex(status);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Pipeline progress</p>
      <ol className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {STAGE_ORDER.map((key, i) => {
          const s = STAGES[i];
          const isPast = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <li key={key} className="flex-1 min-w-[80px]">
              <div className={`flex items-center gap-1.5 ${i > 0 ? "before:content-[''] before:flex-shrink-0 before:h-px before:flex-1 before:-ml-1 before:mr-1 " + (isPast || isCurrent ? "before:bg-[#6800FF]/40" : "before:bg-slate-200") : ""}`}>
                <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  isPast ? "bg-[#6800FF] text-white"
                  : isCurrent ? "bg-[#6800FF] text-white ring-4 ring-[#6800FF]/20"
                  : "bg-slate-200 text-slate-400"
                }`}>
                  {isPast ? <Check size={10} /> : i + 1}
                </div>
              </div>
              <p className={`text-[10px] font-semibold mt-1 leading-tight ${isCurrent ? "text-[#6800FF]" : isPast ? "text-slate-700" : "text-slate-400"}`}>
                {s.shortLabel}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEXT-ACTION CALLOUT — plain English: what's needed and from whom
// ─────────────────────────────────────────────────────────────────────────────
const NEXT_ACTIONS: Record<ClientStatus, { who: string; what: string; tone: string }> = {
  new_client:           { who: "You",        what: "Send the onboarding form to the client below.",                                tone: "bg-blue-50 border-blue-200 text-blue-900" },
  form_pending:         { who: "Client",     what: "Waiting for the client to fill out the onboarding form.",                     tone: "bg-amber-50 border-amber-200 text-amber-900" },
  form_received:        { who: "GTM Eng.",   what: "Form is in. Run the AI agents and source matching accounts via Apollo.",      tone: "bg-purple-50 border-purple-200 text-purple-900" },
  accounts_in_progress: { who: "GTM Eng.",   what: "Keep adding accounts. When the list looks right, send it to the client.",     tone: "bg-purple-50 border-purple-200 text-purple-900" },
  awaiting_approval:    { who: "Client",     what: "Account list sent. Waiting on the client to approve or reject.",              tone: "bg-orange-50 border-orange-200 text-orange-900" },
  data_team_extracting: { who: "Data Team",  what: "Approved. Data team enriches contacts via Sales Nav → Google Sheet → Sync.",  tone: "bg-indigo-50 border-indigo-200 text-indigo-900" },
  ready:                { who: "—",          what: "All set. Contacts are enriched and the client is campaign-ready.",            tone: "bg-emerald-50 border-emerald-200 text-emerald-900" },
};

function NextActionCallout({ client }: { client: OnboardingClientDoc }) {
  const a = NEXT_ACTIONS[client.status];
  return (
    <div className={`rounded-xl border p-3 flex items-start gap-3 ${a.tone}`}>
      <div className="shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-lg bg-white/70 flex items-center justify-center">
          <Sparkles size={14} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Next up · {a.who}</p>
        <p className="text-sm font-semibold mt-0.5">{a.what}</p>
      </div>
    </div>
  );
}

function ClientMeta({ client, onChanged, canEdit }: { client: OnboardingClientDoc; onChanged: () => void; canEdit: boolean }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [contactEmail, setContactEmail] = useState(client.contactEmail);
  const [ownerEmail, setOwnerEmail] = useState(client.ownerEmail);
  const [dataTeamEmail, setDataTeamEmail] = useState(client.dataTeamEmail);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await fetch("/api/onboarding/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorRole: user.role,
          id: client.id,
          data: { contactEmail, ownerEmail, dataTeamEmail },
        }),
      });
      onChanged();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">People</p>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="text-[11px] text-[#6800FF] hover:text-[#5800DD]">Edit</button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="block">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Client contact email</span>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="client@example.com" className="mt-0.5 w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-[#6800FF]" />
          </label>
          <label className="block">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">GTM Engineer</span>
            <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="gtme@thyleads.com" className="mt-0.5 w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-[#6800FF]" />
          </label>
          <label className="block">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Data Team</span>
            <input type="email" value={dataTeamEmail} onChange={(e) => setDataTeamEmail(e.target.value)} placeholder="data@thyleads.com" className="mt-0.5 w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-[#6800FF]" />
          </label>
          <div className="sm:col-span-3 flex gap-2 mt-1">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-[11px] font-semibold rounded">
              {saving ? <><Loader2 size={11} className="animate-spin" /> Saving…</> : <><Check size={11} /> Save</>}
            </button>
            <button onClick={() => setEditing(false)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Client contact</p>
            <p>{client.contactEmail || <span className="italic text-slate-400">not set</span>}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">GTM Engineer</p>
            <p>{client.ownerEmail || <span className="italic text-slate-400">not set</span>}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Data Team</p>
            <p>{client.dataTeamEmail || <span className="italic text-slate-400">not set</span>}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StagePanel({ client, onChanged, canEdit }: { client: OnboardingClientDoc; onChanged: () => void; canEdit: boolean }) {
  // The stage drives what's visible. Form panel is shown for new_client + form_pending.
  // Account universe is shown from form_received → awaiting_approval. Contacts/Sheets is shown for data_team_extracting + ready.
  return (
    <>
      {(client.status === "new_client" || client.status === "form_pending") && <FormPanel client={client} onChanged={onChanged} canEdit={canEdit} />}
      {client.status === "form_received" && <FormAnswersPanel client={client} />}
      {client.status !== "new_client" && client.status !== "form_pending" && (
        <AgentInsightsPanel client={client} canEdit={canEdit} />
      )}
      {(client.status === "form_received" || client.status === "accounts_in_progress" || client.status === "awaiting_approval") && (
        <AccountsPanel client={client} onChanged={onChanged} canEdit={canEdit} />
      )}
      {client.status === "awaiting_approval" && <ApprovalPanel client={client} onChanged={onChanged} canEdit={canEdit} />}
      {(client.status === "data_team_extracting" || client.status === "ready") && (
        <ContactsPanel client={client} onChanged={onChanged} canEdit={canEdit} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM PANEL — generate + send onboarding link
// ─────────────────────────────────────────────────────────────────────────────
function FormPanel({ client, onChanged, canEdit }: { client: OnboardingClientDoc; onChanged: () => void; canEdit: boolean }) {
  const { user } = useAuth();
  const [recipient, setRecipient] = useState(client.contactEmail || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!user || !recipient.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/onboarding/form/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, actorEmail: user.email, clientId: client.id, recipientEmail: recipient.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Failed: ${data.error || res.statusText}`);
        return;
      }
      setGenerated({ url: data.url });
      setMessage(`Onboarding form link sent to ${recipient.trim()}.`);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!generated?.url) return;
    try {
      await navigator.clipboard.writeText(generated.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Inbox size={14} className="text-[#6800FF]" />
        <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Step 1 — Onboarding form</p>
      </div>
      <p className="text-[11px] text-slate-500">
        Sends the client a form to fill in their company info, ICP, and target job titles. Once they submit, the GTM Engineer is notified by email.
      </p>
      {client.status === "form_pending" && client.formSentAt && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Form sent {new Date(client.formSentAt).toLocaleString()} — awaiting client submission.
        </p>
      )}

      {canEdit && (
        <div className="flex items-center gap-2 flex-wrap">
          <input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="client@example.com" className="flex-1 min-w-[200px] px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-[#6800FF]" />
          <button onClick={generate} disabled={busy || !recipient.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-xs font-semibold rounded transition-colors">
            {busy ? <><Loader2 size={11} className="animate-spin" /> Sending…</> : <><Mail size={11} /> {client.status === "form_pending" ? "Resend" : "Send"} form link</>}
          </button>
        </div>
      )}

      {message && <p className="text-[11px] text-slate-700">{message}</p>}
      {generated && (
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded truncate max-w-[420px]">{generated.url}</code>
          <button onClick={copyUrl} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded">
            {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM ANSWERS PANEL — full answer dump using ONBOARDING_FIELDS as schema
// ─────────────────────────────────────────────────────────────────────────────
function FormAnswersPanel({ client }: { client: OnboardingClientDoc }) {
  const [answers, setAnswers] = useState<Record<string, unknown> | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/form/answers?clientId=${encodeURIComponent(client.id)}`, { cache: "no-store" });
        const data = await res.json();
        if (ignore) return;
        setAnswers(data.answers || {});
        setSubmittedAt(data.submittedAt || null);
      } catch {
        if (!ignore) setAnswers({});
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [client.id]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[#6800FF]" />
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Form answers · client&apos;s brief</p>
        </div>
        {submittedAt && (
          <span className="text-[10px] text-slate-400">Submitted {new Date(submittedAt).toLocaleString()}</span>
        )}
      </div>
      <p className="text-[11px] text-slate-500">Everything the client filled in their onboarding form. Used by the AI agents and Apollo search.</p>
      {loading ? (
        <div className="flex items-center justify-center py-3"><Loader2 size={14} className="text-[#6800FF] animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {ONBOARDING_FIELDS.map((field) => (
            <FormAnswerCard key={field.key} field={field} value={answers?.[field.key] ?? fallbackFromClient(field, client)} />
          ))}
        </div>
      )}
    </div>
  );
}

function fallbackFromClient(field: OnboardingFieldDef, client: OnboardingClientDoc): unknown {
  // If the answers endpoint is empty for any reason, fall back to the denormalized fields on the client doc.
  if (field.key === "icp") return client.icp;
  if (field.key === "jobTitles") return client.jobTitles;
  if (field.key === "competitors") return client.competitors;
  return undefined;
}

function FormAnswerCard({ field, value }: { field: OnboardingFieldDef; value: unknown }) {
  const isEmpty =
    value == null ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0);
  const colSpan = field.type === "textarea" ? "sm:col-span-2" : "";
  return (
    <div className={`bg-slate-50/60 border border-slate-200 rounded-lg p-2.5 ${colSpan}`}>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{field.label}</p>
      {isEmpty ? (
        <p className="text-[11px] text-slate-400 italic mt-1">— not answered —</p>
      ) : field.type === "tags" ? (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {(value as string[]).map((t, i) => (
            <span key={i} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${field.key === "jobTitles" ? "bg-[#f0e6ff] text-[#6800FF]" : field.key === "competitors" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>{t}</span>
          ))}
        </div>
      ) : field.type === "number" ? (
        <p className="text-sm font-bold text-slate-800 tabular-nums mt-1">{(value as number).toLocaleString()}</p>
      ) : (
        <p className="text-[11.5px] text-slate-700 mt-1 leading-relaxed whitespace-pre-wrap">{String(value)}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNTS PANEL — Apollo search + manual paste + send-for-approval
// ─────────────────────────────────────────────────────────────────────────────
function AccountsPanel({ client, onChanged, canEdit }: { client: OnboardingClientDoc; onChanged: () => void; canEdit: boolean }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<OnboardingAccountDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [showApollo, setShowApollo] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Apollo form
  const [perPage, setPerPage] = useState(10);
  // Paste form
  const [pasteText, setPasteText] = useState("");
  // Send form
  const [sendRecipient, setSendRecipient] = useState(client.contactEmail || "");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/accounts?clientId=${encodeURIComponent(client.id)}`, { cache: "no-store" });
        const data = await res.json();
        if (!ignore) setAccounts((data.accounts || []) as OnboardingAccountDoc[]);
      } catch {
        if (!ignore) setAccounts([]);
      }
      if (!ignore) setLoading(false);
    })();
    return () => { ignore = true; };
  }, [client.id, tick]);

  const refresh = () => { setTick((n) => n + 1); onChanged(); };

  async function runApollo() {
    if (!user) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/onboarding/accounts/apollo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorRole: user.role,
          createdBy: user.email,
          clientId: client.id,
          industry: client.icp ? [client.icp] : undefined,
          jobTitles: client.jobTitles,
          perPage,
          autoImport: true,
        }),
      });
      const raw = await res.text();
      let data: {
        error?: string; isLive?: boolean; inserted?: number; skipped?: number; totalFound?: number;
        filters?: { industry?: string[]; geos?: string[]; employeeCountMin?: number; employeeCountMax?: number; rationale?: string; resolvedFrom?: string; llmProvider?: string };
      } = {};
      try { data = JSON.parse(raw); } catch { /* non-json (e.g. 500 html page) */ }
      if (!res.ok) {
        setMsg(`Failed (${res.status}): ${data.error || raw.slice(0, 200) || res.statusText}`);
        return;
      }
      const f = data.filters;
      const filterLine = f
        ? ` · filters from ${f.resolvedFrom === "llm" ? `LLM (${f.llmProvider})` : "heuristic"}: industry=[${(f.industry || []).slice(0, 4).join(", ")}], geos=[${(f.geos || []).slice(0, 3).join(", ")}], emp ${f.employeeCountMin}-${f.employeeCountMax}`
        : "";
      setMsg(`Apollo (${data.isLive ? "live" : "mock"}): inserted ${data.inserted}, skipped ${data.skipped}, found ${data.totalFound}.${filterLine}`);
      setShowApollo(false);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runPaste() {
    if (!user || !pasteText.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const rows = parsePastedAccounts(pasteText);
      if (rows.length === 0) {
        setMsg("No rows parsed. Use one company per line, or comma-separated columns.");
        return;
      }
      const res = await fetch("/api/onboarding/accounts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, createdBy: user.email, clientId: client.id, rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Failed: ${data.error || res.statusText}`);
        return;
      }
      setMsg(`Imported ${data.inserted}, skipped ${data.skipped} duplicates.`);
      setPasteText("");
      setShowPaste(false);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sendForApproval() {
    if (!user || !sendRecipient.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/onboarding/accounts/send-for-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, actorEmail: user.email, clientId: client.id, recipientEmail: sendRecipient.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Failed: ${data.error || res.statusText}`);
        return;
      }
      setMsg(`Sent ${data.sentCount} accounts to ${sendRecipient.trim()} for approval.`);
      setShowSend(false);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(id: string) {
    if (!user) return;
    if (!confirm("Remove this account from the list?")) return;
    await fetch(`/api/onboarding/accounts?id=${encodeURIComponent(id)}&actorRole=${user.role}`, { method: "DELETE" });
    refresh();
  }

  const pendingCount = accounts.filter((a) => a.approvalStatus === "pending").length;
  const approvedCount = accounts.filter((a) => a.approvalStatus === "approved").length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-[#6800FF]" />
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Step 2 — Accounts</p>
          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{accounts.length} total · {pendingCount} pending · {approvedCount} approved</span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => { setShowApollo(true); setShowPaste(false); setShowSend(false); }} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#f0e6ff] hover:bg-[#e0ccff] text-[#6800FF] text-[11px] font-semibold rounded">
              <Sparkles size={11} /> Find via Apollo
            </button>
            <button onClick={() => { setShowPaste(true); setShowApollo(false); setShowSend(false); }} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded">
              <Upload size={11} /> Bulk paste
            </button>
            {pendingCount > 0 && client.status !== "awaiting_approval" && (
              <button onClick={() => { setShowSend(true); setShowApollo(false); setShowPaste(false); }} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#6800FF] hover:bg-[#5800DD] text-white text-[11px] font-semibold rounded">
                <Send size={11} /> Send to client for approval
              </button>
            )}
            {client.status === "awaiting_approval" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 text-[11px] font-semibold rounded border border-orange-200">
                Sent to client {client.accountsSentForApprovalAt ? new Date(client.accountsSentForApprovalAt).toLocaleDateString() : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {showApollo && canEdit && (
        <div className="bg-slate-50/60 border border-slate-200 rounded p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Apollo search using ICP from form</p>
            <button onClick={() => setShowApollo(false)} className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={12} /></button>
          </div>
          <p className="text-[10px] text-slate-500">
            Reads <code className="font-mono">icp</code> + <code className="font-mono">jobTitles</code> from the form. If <code className="font-mono">APOLLO_API_KEY</code> isn&apos;t set, returns mock results so you can test the flow.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="block">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Per page</span>
              <input type="number" min={1} max={100} value={perPage} onChange={(e) => setPerPage(Math.max(1, Number(e.target.value) || 25))} className="mt-0.5 w-20 px-2 py-1 border border-slate-200 rounded text-xs tabular-nums" />
            </label>
            <button onClick={runApollo} disabled={busy} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-xs font-semibold rounded">
              {busy ? <><Loader2 size={11} className="animate-spin" /> Searching…</> : <><Sparkles size={11} /> Search + import</>}
            </button>
          </div>
        </div>
      )}

      {showPaste && canEdit && (
        <div className="bg-slate-50/60 border border-slate-200 rounded p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Bulk paste accounts</p>
            <button onClick={() => setShowPaste(false)} className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={12} /></button>
          </div>
          <p className="text-[10px] text-slate-500">
            One company per line, or columns: <code className="font-mono">company,domain,linkedin,website</code>. Header row auto-detected.
          </p>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5} placeholder={"Acme Corp,acme.com\nGlobex Inc,globex.com\nInitech"} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-mono focus:outline-none focus:border-[#6800FF]" />
          <button onClick={runPaste} disabled={busy || !pasteText.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-xs font-semibold rounded">
            {busy ? <><Loader2 size={11} className="animate-spin" /> Importing…</> : <><Check size={11} /> Import</>}
          </button>
        </div>
      )}

      {showSend && canEdit && (
        <div className="bg-orange-50/40 border border-orange-200 rounded p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-orange-800 uppercase tracking-wider">Send {pendingCount} pending accounts to the client for approval</p>
            <button onClick={() => setShowSend(false)} className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={12} /></button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="email" value={sendRecipient} onChange={(e) => setSendRecipient(e.target.value)} placeholder="client@example.com" className="flex-1 min-w-[180px] px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-[#6800FF]" />
            <button onClick={sendForApproval} disabled={busy || !sendRecipient.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-xs font-semibold rounded">
              {busy ? <><Loader2 size={11} className="animate-spin" /> Sending…</> : <><Send size={11} /> Send</>}
            </button>
          </div>
        </div>
      )}

      {msg && <p className="text-[11px] text-slate-700">{msg}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-4"><Loader2 size={14} className="text-[#6800FF] animate-spin" /></div>
      ) : accounts.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">No accounts yet. Use Apollo or Bulk paste to add some.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg max-h-[320px] overflow-y-auto">
          {accounts.map((a) => (
            <li key={a.id} className="px-2.5 py-1.5 flex items-center gap-2 text-xs">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${a.approvalStatus === "approved" ? "bg-emerald-100 text-emerald-700" : a.approvalStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                {a.approvalStatus}
              </span>
              <span className="font-semibold text-slate-800 truncate">{a.companyName}</span>
              {a.domain && <span className="text-[10px] text-slate-400 font-mono">{a.domain}</span>}
              {a.industry && <span className="text-[10px] text-slate-400">· {a.industry}</span>}
              {a.employeeCount > 0 && <span className="text-[10px] text-slate-400">· {a.employeeCount} emp</span>}
              <span className="text-[10px] text-slate-400 ml-auto">{a.source}</span>
              {a.linkedinUrl && <a href={a.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#6800FF]"><LinkIcon size={10} /></a>}
              {a.websiteUrl && <a href={a.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#6800FF]"><Globe size={10} /></a>}
              {canEdit && (
                <button onClick={() => deleteAccount(a.id)} className="text-slate-400 hover:text-red-500"><X size={10} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APPROVAL PANEL — record client approval (or rejection); advances stage
// ─────────────────────────────────────────────────────────────────────────────
function ApprovalPanel({ client, onChanged, canEdit }: { client: OnboardingClientDoc; onChanged: () => void; canEdit: boolean }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function approveAll() {
    if (!user) return;
    if (!confirm("Mark all pending accounts as approved by the client? This will email the Data Team handoff.")) return;
    setBusy(true);
    setMsg(null);
    try {
      // 1. flip every pending account to approved
      await fetch("/api/onboarding/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, action: "approve-all", clientId: client.id }),
      });
      // 2. advance client status + trigger Data-Team email
      const res2 = await fetch("/api/onboarding/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, actorEmail: user.email, action: "client-approve-accounts", id: client.id }),
      });
      const data = await res2.json();
      if (!res2.ok) {
        setMsg(`Failed: ${data.error || res2.statusText}`);
        return;
      }
      setMsg("Approved. Data Team has been notified by email.");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function rejectAll() {
    if (!user) return;
    if (!confirm("Mark all pending accounts as rejected? You'll need to source new accounts.")) return;
    setBusy(true);
    setMsg(null);
    try {
      await fetch("/api/onboarding/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, action: "reject-all", clientId: client.id }),
      });
      // Move back to accounts_in_progress so GTME can re-source.
      await fetch("/api/onboarding/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, id: client.id, data: { status: "accounts_in_progress" } }),
      });
      setMsg("Rejected. GTM Engineer needs to re-source.");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-orange-50/40 border border-orange-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} className="text-orange-700" />
        <p className="text-[11px] font-bold text-orange-800 uppercase tracking-wider">Step 3 — Client approval</p>
      </div>
      <p className="text-[11px] text-slate-600">
        Account list was sent to the client {client.accountsSentForApprovalAt ? `on ${new Date(client.accountsSentForApprovalAt).toLocaleString()}` : ""}.
        Once they reply, record their decision here. Approval auto-emails the Data Team to start enrichment.
      </p>
      {canEdit && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={approveAll} disabled={busy} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded">
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Mark approved
          </button>
          <button onClick={rejectAll} disabled={busy} className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 text-xs font-semibold rounded border border-red-200">
            <X size={11} /> Reject — re-source
          </button>
        </div>
      )}
      {msg && <p className="text-[11px] text-slate-700">{msg}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTACTS PANEL — Google Sheets import + manual add for the Data Team
// ─────────────────────────────────────────────────────────────────────────────
function ContactsPanel({ client, onChanged, canEdit }: { client: OnboardingClientDoc; onChanged: () => void; canEdit: boolean }) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<OnboardingContactDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const [sheetUrl, setSheetUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/contacts?clientId=${encodeURIComponent(client.id)}`, { cache: "no-store" });
        const data = await res.json();
        if (!ignore) setContacts((data.contacts || []) as OnboardingContactDoc[]);
      } catch {
        if (!ignore) setContacts([]);
      }
      if (!ignore) setLoading(false);
    })();
    return () => { ignore = true; };
  }, [client.id, tick]);

  const refresh = () => { setTick((n) => n + 1); onChanged(); };

  async function syncSheet() {
    if (!user || !sheetUrl.trim()) return;
    setBusy(true);
    setMsg(null);
    setWarnings([]);
    try {
      const res = await fetch("/api/onboarding/contacts/sheet-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, createdBy: user.email, clientId: client.id, sheetUrl: sheetUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Failed: ${data.error || res.statusText}`);
        if (Array.isArray(data.warnings)) setWarnings(data.warnings);
        return;
      }
      const um = data.unmatchedCompany ?? 0;
      setMsg(`Synced from sheet · imported ${data.inserted}, skipped ${data.skipped} duplicates${um > 0 ? `, ${um} contacts whose company didn't match an account` : ""}.`);
      if (Array.isArray(data.warnings)) setWarnings(data.warnings);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function markReady() {
    if (!user) return;
    if (!confirm("Mark this client as Ready? They'll show up as enrichment-complete and ready for campaigns.")) return;
    setBusy(true);
    try {
      await fetch("/api/onboarding/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, action: "mark-ready", id: client.id }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function deleteContact(id: string) {
    if (!user) return;
    if (!confirm("Remove this contact?")) return;
    await fetch(`/api/onboarding/contacts?id=${encodeURIComponent(id)}&actorRole=${user.role}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[#6800FF]" />
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Step 4 — Data Team enrichment</p>
          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</span>
        </div>
        {canEdit && client.status === "data_team_extracting" && contacts.length > 0 && (
          <button onClick={markReady} disabled={busy} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-[11px] font-semibold rounded">
            <Check size={11} /> Mark ready
          </button>
        )}
        {client.status === "ready" && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded border border-emerald-200">
            <Check size={11} /> Ready
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        The Data Team builds a Google Sheet with columns: <strong>Company, First name, Last name, Job title, LinkedIn URL</strong> (email + notes optional).
        Share the sheet as &quot;Anyone with the link can view&quot;, paste the URL below, click Sync.
      </p>

      {canEdit && (
        <div className="flex items-center gap-2 flex-wrap">
          <input type="url" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0" className="flex-1 min-w-[260px] px-2 py-1.5 border border-slate-200 rounded text-xs font-mono focus:outline-none focus:border-[#6800FF]" />
          <button onClick={syncSheet} disabled={busy || !sheetUrl.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-xs font-semibold rounded">
            {busy ? <><Loader2 size={11} className="animate-spin" /> Syncing…</> : <><RefreshCw size={11} /> Sync from sheet</>}
          </button>
        </div>
      )}

      {msg && <p className="text-[11px] text-slate-700">{msg}</p>}
      {warnings.length > 0 && (
        <ul className="text-[10px] text-amber-700 space-y-0.5">
          {warnings.map((w, i) => <li key={i} className="flex items-start gap-1"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{w}</li>)}
        </ul>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4"><Loader2 size={14} className="text-[#6800FF] animate-spin" /></div>
      ) : contacts.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">No contacts yet. Paste the sheet URL above to import.</p>
      ) : (
        <div className="border border-slate-100 rounded-lg max-h-[360px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500">Name</th>
                <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500">Job title</th>
                <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500">Company</th>
                <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500">LinkedIn</th>
                <th className="px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500">Email</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td className="px-2 py-1.5 font-semibold text-slate-800">{c.firstName} {c.lastName}</td>
                  <td className="px-2 py-1.5 text-slate-600">{c.jobTitle || "—"}</td>
                  <td className="px-2 py-1.5 text-slate-600">{c.companyName || "—"}</td>
                  <td className="px-2 py-1.5">{c.linkedinUrl ? <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[#6800FF] hover:underline inline-flex items-center gap-0.5"><LinkIcon size={10} /> profile</a> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-2 py-1.5 text-slate-600 font-mono text-[10px]">{c.email || "—"}</td>
                  <td className="px-2 py-1.5 text-right">
                    {canEdit && <button onClick={() => deleteContact(c.id)} className="text-slate-400 hover:text-red-500"><X size={10} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DANGER ZONE — delete client + cascade
// ─────────────────────────────────────────────────────────────────────────────
function DangerZone({ client, onChanged }: { client: OnboardingClientDoc; onChanged: () => void }) {
  const { user } = useAuth();
  async function del() {
    if (!user) return;
    if (!confirm(`Delete "${client.name}" and all their accounts, contacts, forms, and emails? Cannot be undone.`)) return;
    await fetch(`/api/onboarding/clients?id=${encodeURIComponent(client.id)}&actorRole=${user.role}`, { method: "DELETE" });
    onChanged();
  }
  return (
    <div className="pt-2 border-t border-red-200/60">
      <button onClick={del} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold rounded border border-red-200">
        <Trash2 size={11} /> Remove from pipeline
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT INSIGHTS PANEL — 4-agent AI pipeline (research / demand / icp / synthesis)
// ─────────────────────────────────────────────────────────────────────────────
type AgentKind = "research" | "demand" | "icp" | "synthesis";
interface AgentResult {
  kind: AgentKind;
  status: "running" | "complete" | "failed";
  output: string;
  data?: unknown;
  model: string;
  isLive: boolean;
  inputTokens: number;
  outputTokens: number;
  startedAt: string | null;
  completedAt: string | null;
  error?: string;
}
interface AgentRun {
  id: string;
  clientId: string;
  status: "running" | "complete" | "failed";
  agents: AgentResult[];
  triggeredBy: string;
  startedAt: string | null;
  completedAt: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  isLive: boolean;
}

const AGENT_META: Record<AgentKind, { label: string; subtitle: string; explainer: string; icon: typeof Bot; tone: string }> = {
  research: {
    label: "Agent 1 · General research",
    subtitle: "What does this client actually do?",
    explainer: "Reads the form answers and writes a one-pager about the client — what they sell, their stage, recent news, and the buyer pain they solve. This becomes context for the other 3 agents.",
    icon: Search,
    tone: "bg-blue-50 text-blue-700 border-blue-200",
  },
  demand: {
    label: "Agent 2 · Product demand",
    subtitle: "Is the market actually buying right now?",
    explainer: "Checks demand signals (hiring activity, conference activity, recent funding) for the client's buyer segments. Uses an MCP server when configured. Returns a Demand Score 1-10.",
    icon: TrendingUp,
    tone: "bg-amber-50 text-amber-700 border-amber-200",
  },
  icp: {
    label: "Agent 3 · ICP discovery",
    subtitle: "Which companies should we go after?",
    explainer: "Pulls candidates from Apollo using filters extracted from the client's form, then ranks the Top-10 with rationale and a list of disqualifiers. This is the seed list the GTM Engineer reviews.",
    icon: Target,
    tone: "bg-purple-50 text-purple-700 border-purple-200",
  },
  synthesis: {
    label: "Agent 4 · Synthesis + verify",
    subtitle: "What do we send the prospects?",
    explainer: "Reads the outputs of Agents 1-3, writes a 3-step email sequence + 2 LinkedIn touches in the client's voice, and flags any claims that should be fact-checked before sending.",
    icon: Wand2,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};
const AGENT_ORDER: AgentKind[] = ["research", "demand", "icp", "synthesis"];

function AgentInsightsPanel({ client, canEdit }: { client: OnboardingClientDoc; canEdit: boolean }) {
  const { user } = useAuth();
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openKind, setOpenKind] = useState<AgentKind | null>(null);

  useEffect(() => {
    let ignore = false;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/onboarding/agents?clientId=${encodeURIComponent(client.id)}`, { cache: "no-store" });
        const data = await res.json();
        if (ignore) return;
        setRun(data.run as AgentRun | null);
      } catch {
        if (!ignore) setRun(null);
      }
      if (!ignore) setLoading(false);
    };
    tick();
    // While a run is in progress, poll every 2s. Otherwise refresh every 30s
    // (cheap insurance against another tab kicking off a run).
    const interval = setInterval(() => { if (!cancelled) tick(); }, 2000);
    return () => { ignore = true; cancelled = true; clearInterval(interval); };
  }, [client.id]);

  async function runNow() {
    if (!user) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, actorEmail: user.email, clientId: client.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || `Failed (${res.status})`);
        return;
      }
      setRun(data.run as AgentRun);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }

  const agentMap = new Map<AgentKind, AgentResult>();
  for (const a of run?.agents ?? []) agentMap.set(a.kind, a);

  const isRunning = run?.status === "running" || busy;
  const tokenTotal = (run?.totalInputTokens ?? 0) + (run?.totalOutputTokens ?? 0);

  // Provider label is whatever model the agents reported. If they're a mix, show the first non-mock.
  const providerModel = (run?.agents || []).find((a) => a.model && a.model !== "mock")?.model || "mock";
  const providerLabel = providerLabelFromModel(providerModel);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
      {/* Header row: title + status + provider + run button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Bot size={14} className="text-[#6800FF]" />
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">AI insights · 4-agent pipeline</p>
          {run && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              run.status === "complete" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : run.status === "failed" ? "bg-red-50 text-red-700 border-red-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              {run.status}
            </span>
          )}
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${run?.isLive ? "bg-[#f0e6ff] text-[#6800FF]" : "bg-slate-100 text-slate-500"}`}>
            {run?.isLive ? <><Sparkles size={10} /> live · {providerLabel}</> : <>mock · no API key</>}
          </span>
          {tokenTotal > 0 && <span className="text-[10px] text-slate-400 tabular-nums">{tokenTotal.toLocaleString()} tokens</span>}
        </div>
        {canEdit && (
          <button
            onClick={runNow}
            disabled={busy || isRunning}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-[11px] font-semibold rounded transition-colors"
          >
            {busy ? <><Loader2 size={11} className="animate-spin" /> Running…</>
              : run ? <><RefreshCw size={11} /> Re-run</>
              : <><Play size={11} /> Run AI agents</>}
          </button>
        )}
      </div>

      {/* Plain-English explainer of what this panel does */}
      <div className="bg-[#f8f5ff] border border-[#6800FF]/15 rounded-lg p-2.5 text-[11px] text-slate-600">
        <p className="font-semibold text-[#6800FF] mb-0.5">What is this?</p>
        <p>
          Four AI agents read the client&apos;s onboarding form and run in parallel — one researches the client, one checks market demand,
          one ranks the best-fit companies via Apollo, and one writes the outreach copy with verification notes.
          {run?.isLive
            ? ` Currently using ${providerLabel}.`
            : " Add a free Groq or Gemini key to .env.local to switch from mocks to real output."}
        </p>
      </div>

      {err && <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{err}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-3"><Loader2 size={14} className="text-[#6800FF] animate-spin" /></div>
      ) : !run ? (
        <div className="bg-slate-50/60 border border-dashed border-slate-300 rounded-lg p-4 text-center">
          <Bot size={20} className="text-slate-400 mx-auto" />
          <p className="text-[12px] font-semibold text-slate-700 mt-2">No run yet</p>
          <p className="text-[11px] text-slate-500 mt-0.5 max-w-md mx-auto">
            Click <strong>Run AI agents</strong> to generate the brief, market read, ranked accounts, and outreach copy.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AGENT_ORDER.map((kind) => {
            const r = agentMap.get(kind);
            const meta = AGENT_META[kind];
            const Icon = meta.icon;
            const open = openKind === kind;
            const status: AgentResult["status"] = r?.status ?? (run.status === "running" ? "running" : "failed");
            return (
              <div key={kind} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenKind(open ? null : kind)}
                  className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-slate-50/60 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${meta.tone} shrink-0`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{meta.label}</p>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 truncate">{meta.subtitle}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <AgentStatusPill status={status} />
                      {r && r.outputTokens > 0 && <span className="text-[9px] text-slate-400 tabular-nums">{r.outputTokens.toLocaleString()} tok out</span>}
                      {r?.completedAt && r.startedAt && (
                        <span className="text-[9px] text-slate-400 inline-flex items-center gap-0.5"><Clock size={9} /> {Math.max(1, Math.round((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000))}s</span>
                      )}
                    </div>
                  </div>
                  {open ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                </button>
                {open && (
                  <div className="px-3 py-3 border-t border-slate-200 bg-slate-50/30 space-y-2">
                    <p className="text-[10.5px] text-slate-500 italic leading-relaxed">{meta.explainer}</p>
                    {r?.error && <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{r.error}</p>}
                    {r?.output ? (
                      <div className="bg-white border border-slate-200 rounded-md p-3">
                        <MarkdownRender text={r.output} />
                      </div>
                    ) : status === "running" ? (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 py-2">
                        <Loader2 size={12} className="animate-spin text-[#6800FF]" /> Generating…
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No output captured.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function providerLabelFromModel(model: string): string {
  if (!model || model === "mock") return "mock";
  if (model.startsWith("claude")) return "Claude";
  if (model.startsWith("llama")) return "Groq · Llama";
  if (model.startsWith("gemini")) return "Gemini";
  return model;
}

// Tiny markdown renderer — handles headings, bold, italic, code, lists, and paragraphs.
// Keeps the bundle thin (no react-markdown dep) while making agent output readable.
function MarkdownRender({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  function inline(s: string): React.ReactNode {
    // Order matters: code first, then bold, then italic.
    const parts: React.ReactNode[] = [];
    let rest = s;
    let pk = 0;
    const tokens = [
      { re: /`([^`]+)`/, render: (m: string) => <code key={pk++} className="px-1 py-0.5 bg-slate-100 text-[#6800FF] rounded font-mono text-[10.5px]">{m}</code> },
      { re: /\*\*([^*]+)\*\*/, render: (m: string) => <strong key={pk++} className="font-bold text-slate-900">{m}</strong> },
      { re: /\*([^*]+)\*/, render: (m: string) => <em key={pk++} className="italic">{m}</em> },
    ];
    while (rest.length > 0) {
      let earliest = -1;
      let chosen: typeof tokens[number] | null = null;
      for (const t of tokens) {
        const m = rest.match(t.re);
        if (m && m.index !== undefined && (earliest === -1 || m.index < earliest)) {
          earliest = m.index;
          chosen = t;
        }
      }
      if (!chosen || earliest === -1) {
        parts.push(rest);
        break;
      }
      const m = rest.match(chosen.re)!;
      if (earliest > 0) parts.push(rest.slice(0, earliest));
      parts.push(chosen.render(m[1]));
      rest = rest.slice(earliest + m[0].length);
    }
    return parts;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = level <= 1 ? "text-[15px] font-bold text-slate-900 mt-1"
        : level === 2 ? "text-[13px] font-bold text-slate-900 mt-2.5"
        : "text-[12px] font-bold text-slate-800 mt-2";
      blocks.push(<p key={key++} className={cls}>{inline(h[2])}</p>);
      i++;
      continue;
    }

    // List (consecutive `-` or `*` or `1.` lines)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc list-outside ml-4 space-y-0.5 text-[11px] text-slate-700">
          {items.map((it, idx) => <li key={idx} className="leading-relaxed">{inline(it)}</li>)}
        </ul>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      blocks.push(<p key={key++} className="text-[10.5px] text-slate-500 italic border-l-2 border-slate-200 pl-2 ml-1">{inline(line.slice(1).trim())}</p>);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="border-slate-200 my-2" />);
      i++;
      continue;
    }

    // Empty line — paragraph break (skip)
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: gather consecutive non-empty, non-heading, non-list lines
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6})\s+/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) && !lines[i].startsWith(">")) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key++} className="text-[11px] text-slate-700 leading-relaxed">{inline(para.join(" "))}</p>);
  }

  return <div className="space-y-1.5">{blocks}</div>;
}

function AgentStatusPill({ status }: { status: AgentResult["status"] }) {
  if (status === "complete") return <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">complete</span>;
  if (status === "failed") return <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700">failed</span>;
  return <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 inline-flex items-center gap-0.5"><Loader2 size={9} className="animate-spin" /> running</span>;
}

// Parse pasted accounts: either one company per line, or comma-separated columns.
function parsePastedAccounts(text: string): { companyName: string; domain?: string; linkedinUrl?: string; websiteUrl?: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  let startIdx = 0;
  let cols: ("companyName" | "domain" | "linkedinUrl" | "websiteUrl" | "skip")[] = ["companyName", "domain", "linkedinUrl", "websiteUrl"];
  const headerCandidate = lines[0].toLowerCase();
  if (headerCandidate.includes(",") && (headerCandidate.includes("company") || headerCandidate.includes("name"))) {
    cols = headerCandidate.split(",").map((h) => {
      const k = h.trim();
      if (/(company|name)/.test(k)) return "companyName";
      if (/(domain)/.test(k)) return "domain";
      if (/(linkedin)/.test(k)) return "linkedinUrl";
      if (/(website|site|url)/.test(k)) return "websiteUrl";
      return "skip";
    });
    startIdx = 1;
  }
  const rows: { companyName: string; domain?: string; linkedinUrl?: string; websiteUrl?: string }[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const row: { companyName: string; domain?: string; linkedinUrl?: string; websiteUrl?: string } = { companyName: "" };
    for (let j = 0; j < cells.length; j++) {
      const col = cols[j] || "skip";
      if (col === "skip") continue;
      const val = cells[j];
      if (!val) continue;
      if (col === "companyName") row.companyName = val;
      else if (col === "domain") row.domain = val.toLowerCase();
      else if (col === "linkedinUrl") row.linkedinUrl = val;
      else if (col === "websiteUrl") row.websiteUrl = val;
    }
    if (row.companyName) rows.push(row);
  }
  return rows;
}
