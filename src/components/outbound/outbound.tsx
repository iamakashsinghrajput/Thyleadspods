"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Rocket, Inbox, ChevronRight, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import PilotDetailView from "./pilot-detail";
import type { PilotSummary } from "./types";

export default function OutboundDashboard() {
  const { user } = useAuth();
  const canEdit = user?.role === "superadmin" || user?.role === "admin";
  const [pilots, setPilots] = useState<PilotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/outbound/pilots", { cache: "no-store" });
        const data = await res.json();
        if (!ignore) setPilots((data.pilots || []) as PilotSummary[]);
      } catch {
        if (!ignore) setPilots([]);
      }
      if (!ignore) setLoading(false);
    })();
    return () => { ignore = true; };
  }, [tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  if (activeId) {
    return (
      <PilotDetailView
        pilotId={activeId}
        onBack={() => { setActiveId(null); refresh(); }}
        canEdit={canEdit}
      />
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#6800FF] to-[#9b00ff] text-white flex items-center justify-center shadow-md shadow-[#6800FF]/20">
              <Rocket size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Outbound Pipeline</h1>
              <p className="text-sm text-slate-500 mt-0.5">VWO India outbound pilot. 11 phases from raw target list to a Smartlead-ready CSV.</p>
            </div>
          </div>
          {canEdit && (
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6800FF] hover:bg-[#5800DD] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
              <Plus size={14} /> New pilot
            </button>
          )}
        </div>

        <PipelineHelp />

        {showCreate && canEdit && (
          <CreatePilotForm
            onCreated={(id) => { setShowCreate(false); refresh(); setActiveId(id); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="text-[#6800FF] animate-spin" />
          </div>
        ) : pilots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center mb-3">
              <Inbox size={20} className="text-slate-500" />
            </div>
            <p className="text-sm font-bold text-slate-700">No pilots yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">Create a pilot to kick off the 11-phase pipeline. Upload your target list, DNC, active customers, past meetings — and watch each phase complete.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pilots.map((p) => (
              <PilotRow key={p.id} pilot={p} onOpen={() => setActiveId(p.id)} onDeleted={refresh} canEdit={canEdit} actorRole={user?.role} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const PHASE_LABELS = [
  "Ingest", "Filter", "Subset", "Enrich", "Score",
  "People", "Emails", "Research", "Draft", "Validate", "Export",
];

function PilotRow({ pilot, onOpen, onDeleted, canEdit, actorRole }: { pilot: PilotSummary; onOpen: () => void; onDeleted: () => void; canEdit: boolean; actorRole?: string }) {
  const completed = pilot.phases.filter((p) => p.status === "complete").length;
  const failed = pilot.phases.find((p) => p.status === "failed");
  const running = pilot.phases.find((p) => p.status === "running");

  async function del(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete pilot "${pilot.pilotName}"? All accounts, leads, and drafts will be removed.`)) return;
    await fetch(`/api/outbound/pilots?id=${pilot.id}&actorRole=${actorRole}`, { method: "DELETE" });
    onDeleted();
  }

  return (
    <div onClick={onOpen} className="bg-white border border-slate-200 hover:border-[#6800FF]/40 rounded-2xl p-4 sm:p-5 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 truncate">{pilot.pilotName}</h3>
            <StatusBadge status={pilot.status} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{pilot.clientName}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {completed}/11 phases complete · Apollo credits: {pilot.totalApolloCredits} · Tokens: {pilot.totalLlmTokensIn + pilot.totalLlmTokensOut}
            {running ? ` · running ${running.key}` : ""}
            {failed ? ` · failed at ${failed.key}` : ""}
          </p>

          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {pilot.phases.map((p, i) => (
              <PhaseChip key={p.key} index={i} status={p.status} label={PHASE_LABELS[i]} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canEdit && (
            <button onClick={del} title="Delete" className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          <ChevronRight size={18} className="text-slate-300" />
        </div>
      </div>
    </div>
  );
}

function PhaseChip({ index, status, label }: { index: number; status: string; label: string }) {
  const dot =
    status === "complete" ? "bg-emerald-500" :
    status === "running" ? "bg-blue-500 animate-pulse" :
    status === "failed" ? "bg-red-500" :
    "bg-slate-300";
  const ring = status === "running" ? "ring-2 ring-blue-200" : "";
  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${ring} bg-slate-50 border border-slate-200`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span className="text-slate-500">{index + 1}</span>
      <span className="text-slate-700">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ready" ? "bg-emerald-100 text-emerald-700" :
    status === "running" ? "bg-blue-100 text-blue-700" :
    status === "failed" ? "bg-red-100 text-red-700" :
    status === "paused" ? "bg-amber-100 text-amber-700" :
    "bg-slate-100 text-slate-600";
  return <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}>{status}</span>;
}

function PipelineHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-linear-to-br from-[#f8f5ff] to-white rounded-2xl border border-[#6800FF]/20">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#6800FF]/10 text-[#6800FF] flex items-center justify-center"><Rocket size={14} /></div>
          <p className="text-sm font-bold text-slate-900">How the outbound pipeline works</p>
        </div>
        <span className="text-[11px] text-slate-500">{open ? "Hide" : "Show"} 11 phases</span>
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {[
            { n: 1, t: "Ingest", b: "Parse uploaded targets, DNC, active customers, past meetings." },
            { n: 2, t: "Filter", b: "Remove DNC, active customers, past-meeting matches, seller domains." },
            { n: 3, t: "Subset", b: "Pick a 400-600 priority list with TLD priority + negative-pattern filter." },
            { n: 4, t: "Enrich", b: "Bulk enrich firmographic + behavioral data via Apollo." },
            { n: 5, t: "Score", b: "8-dimension rubric, top 50 with industry-diversity guard." },
            { n: 6, t: "People", b: "Find Champion title at each top account via Apollo." },
            { n: 7, t: "Emails", b: "Get verified emails via Apollo people bulk match." },
            { n: 8, t: "Research", b: "Find one observable thing per lead for the body 1 opener." },
            { n: 9, t: "Compile prompts", b: "Build a per-lead Claude prompt from the research. You paste each into your Claude Pro Project to get the email." },
            { n: 10, t: "Validate", b: "Confirm every lead has a verified email + a complete prompt ready to paste." },
            { n: 11, t: "Export", b: "Produce the leads XLSX with claude_prompt column + Project Instructions Markdown." },
          ].map((p) => (
            <div key={p.n} className="bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-2.5">
              <div className="shrink-0 w-7 h-7 rounded-lg bg-[#f0e6ff] text-[#6800FF] flex items-center justify-center font-bold text-[11px]">{p.n}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-slate-800">{p.t}</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{p.b}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreatePilotForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const { user } = useAuth();
  const [pilotName, setPilotName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!pilotName.trim() || !user) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/outbound/pilots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorRole: user.role,
          createdBy: user.email,
          clientName: "VWO",
          pilotName: pilotName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || `Failed (${res.status})`); return; }
      onCreated(data.id);
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#6800FF]/30 ring-1 ring-[#6800FF]/10 p-4 sm:p-5 space-y-3">
      <p className="text-sm font-bold text-slate-900">New VWO pilot</p>
      <label className="block">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pilot name *</span>
        <input
          type="text" value={pilotName} onChange={(e) => setPilotName(e.target.value)}
          placeholder="VWO India D2C — Wave 1"
          className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15"
        />
      </label>
      {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{err}</p>}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={busy || !pilotName.trim()} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors">
          {busy ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : <><Plus size={13} /> Create pilot</>}
        </button>
        <button onClick={onCancel} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg">Cancel</button>
      </div>
    </div>
  );
}
