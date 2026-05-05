"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Play, Loader2, Download, Upload, FileText, Users, Sliders, BookOpen, Briefcase, Square, FlaskConical } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import PhaseCard from "./phase-card";
import LeadsTable from "./leads-table";
import AccountsTable from "./accounts-table";
import InputsForm from "./inputs-form";
import ConfigForm from "./config-form";
import SkillForm from "./skill-form";
import BriefForm from "./brief-form";
import type { PilotDetail } from "./types";
import type { PhaseState } from "@/lib/outbound/types";

const PHASE_TITLES: Record<string, { title: string; agent: string; description: string; number: number }> = {
  ingest:      { number: 1,  title: "Data ingestion",         agent: "ingest-agent",      description: "Parse uploaded targets, DNC, active customers, past meetings." },
  filter:      { number: 2,  title: "Filter & exclusion",     agent: "filter-agent",      description: "Remove DNC, active customers, past meetings, seller domains." },
  subset:      { number: 3,  title: "Smart subset",           agent: "subset-agent",      description: "Priority TLD + negative-pattern filter to a 400-600 list." },
  enrich:      { number: 4,  title: "Apollo enrichment",      agent: "enrich-agent",      description: "Bulk enrich firmographic + behavioral data via Apollo." },
  score:       { number: 5,  title: "Account scoring",        agent: "score-agent",       description: "8-dimension rubric, top 50 with industry-diversity guard." },
  stakeholder: { number: 6,  title: "Stakeholder discovery",  agent: "stakeholder-agent", description: "Find Champion title at each top account via Apollo." },
  email_match: { number: 7,  title: "Email enrichment",       agent: "email-match-agent", description: "Get verified emails via Apollo people bulk match." },
  research:    { number: 8,  title: "Per-account research",   agent: "research-agent",    description: "One observable thing per lead for the body 1 opener." },
  draft:       { number: 9,  title: "Compile Claude prompts", agent: "prompt-builder",    description: "Build per-lead Claude prompts from research. Paste each into Claude Pro to draft." },
  validate:    { number: 10, title: "Validation",             agent: "validate-agent",    description: "Check every lead has a prompt + email ready." },
  export:      { number: 11, title: "Smartlead CSV",          agent: "export-agent",      description: "The final Smartlead-ready CSV." },
};

type Tab = "pipeline" | "inputs" | "brief" | "config" | "skill" | "accounts" | "leads" | "testLeads";

export default function PilotDetailView({ pilotId, onBack, canEdit }: { pilotId: string; onBack: () => void; canEdit: boolean }) {
  const { user } = useAuth();
  const [data, setData] = useState<PilotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pipeline");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}`, { cache: "no-store" });
      const d = (await res.json()) as PilotDetail;
      setData(d);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [pilotId]);

  useEffect(() => {
    fetchOnce();
  }, [fetchOnce]);

  useEffect(() => {
    if (!data) return;
    const running = data.pilot.phases.find((p) => p.status === "running");
    if (!running && data.pilot.status !== "running") return;
    const t = setInterval(fetchOnce, 2500);
    return () => clearInterval(t);
  }, [data, fetchOnce]);

  const stats = useMemo(() => {
    if (!data) return { complete: 0, total: 11, totalDuration: 0, leadsShippable: 0 };
    const complete = data.pilot.phases.filter((p) => p.status === "complete").length;
    const totalDuration = data.pilot.phases.reduce((a, b) => a + (b.durationMs || 0), 0);
    const leadsShippable = data.leads.filter((l) => l.shippable).length;
    return { complete, total: 11, totalDuration, leadsShippable };
  }, [data]);

  async function stopRun() {
    if (!user) return;
    if (!confirm("Stop the running pipeline? The orchestrator will halt at the next phase or batch boundary (typically <30s). Already-completed phases stay saved.")) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, actorEmail: user.email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || `Stop failed (${res.status})`);
        return;
      }
      setTimeout(fetchOnce, 600);
    } finally { setBusy(false); }
  }

  async function startRun(opts: { stopAfter?: string; startFrom?: string; testLimit?: number } = {}) {
    if (!user) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorRole: user.role,
          ...(opts.stopAfter ? { stopAfter: opts.stopAfter } : {}),
          ...(opts.startFrom ? { startFrom: opts.startFrom } : {}),
          ...(opts.testLimit ? { testLimit: opts.testLimit } : {}),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || `Run failed (${res.status})`);
        return;
      }
      setTimeout(fetchOnce, 600);
    } finally { setBusy(false); }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={20} className="text-[#6800FF] animate-spin" />
      </div>
    );
  }

  const inputsReady = (data.pilot.inputs?.targets as string[] | undefined)?.length || 0;
  const running = data.pilot.phases.some((p) => p.status === "running") || data.pilot.status === "running";

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#6800FF] transition-colors">
            <ArrowLeft size={13} /> All pilots
          </button>
        </div>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{data.pilot.pilotName}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{data.pilot.clientName} · {stats.complete}/{stats.total} phases · {Math.round(stats.totalDuration / 1000)}s elapsed</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <>
                {running ? (
                  <button
                    onClick={stopRun} disabled={busy}
                    title="Stop the running pipeline. Halts at the next phase or batch boundary (~30s)."
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <Square size={13} className="fill-white" /> Stop
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => startRun({ testLimit: 10 })} disabled={busy || inputsReady === 0}
                      title={inputsReady === 0 ? "Upload your target list first." : "Run all phases but cap to 10 leads — fast iteration on SKILL.md"}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Play size={12} /> Test run (10)
                    </button>
                    <button
                      onClick={() => startRun()} disabled={busy || inputsReady === 0}
                      title={inputsReady === 0 ? "Upload your target list first." : ""}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      <Play size={13} /> Run full pipeline
                    </button>
                  </>
                )}
              </>
            )}
            <a href={`/api/outbound/pilots/${pilotId}/claude-instructions`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#6800FF]/30 text-[#6800FF] hover:bg-[#f0e6ff] text-xs font-semibold rounded-lg transition-colors" title="Download the Claude Project instructions (paste into Claude.ai Project → Project instructions, once)">
              <Download size={13} /> Project instructions (.md)
            </a>
            {data.leads.length > 0 && (
              <>
                <a href={`/api/outbound/pilots/${pilotId}/xlsx`} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors" title="Download live leads with subject_1/body_1...subject_3/body_3 columns">
                  <Download size={13} /> Download leads .xlsx
                </a>
                {data.pilot.hasCsv && (
                  <a href={`/api/outbound/pilots/${pilotId}/csv`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold rounded-lg transition-colors" title="Download raw CSV (snapshot from last export run)">
                    .csv
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{err}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label="Targets ingested" value={String((data.pilot.inputs?.targets as string[] | undefined)?.length || 0)} />
          <StatTile label="Apollo credits" value={String(data.pilot.totalApolloCredits)} sublabel={`budget ${(data.pilot.config as { apolloCreditsBudget?: number })?.apolloCreditsBudget || 700}`} />
          <StatTile label="LLM tokens" value={String(data.pilot.totalLlmTokensIn + data.pilot.totalLlmTokensOut)} sublabel={`in ${data.pilot.totalLlmTokensIn} · out ${data.pilot.totalLlmTokensOut}`} />
          <StatTile label="Shippable leads" value={`${stats.leadsShippable} / ${data.leads.length}`} />
        </div>

        <div className="flex items-center gap-1 border-b border-slate-200">
          <TabButton active={tab === "pipeline"} onClick={() => setTab("pipeline")} icon={<Play size={13} />}>Pipeline</TabButton>
          <TabButton active={tab === "inputs"} onClick={() => setTab("inputs")} icon={<Upload size={13} />}>Inputs</TabButton>
          <TabButton active={tab === "brief"} onClick={() => setTab("brief")} icon={<Briefcase size={13} />}>Client Brief</TabButton>
          <TabButton active={tab === "config"} onClick={() => setTab("config")} icon={<Sliders size={13} />}>Config</TabButton>
          <TabButton active={tab === "skill"} onClick={() => setTab("skill")} icon={<BookOpen size={13} />}>SKILL.md</TabButton>
          <TabButton active={tab === "accounts"} onClick={() => setTab("accounts")} icon={<FileText size={13} />}>Accounts <span className="ml-1 text-[10px] text-slate-400">({data.accounts.length})</span></TabButton>
          <TabButton active={tab === "leads"} onClick={() => setTab("leads")} icon={<Users size={13} />}>Leads <span className="ml-1 text-[10px] text-slate-400">({data.leads.length})</span></TabButton>
          <TabButton active={tab === "testLeads"} onClick={() => setTab("testLeads")} icon={<FlaskConical size={13} />}>
            <span className="text-amber-700">Test leads</span>
            <span className="ml-1 text-[10px] text-slate-400">({data.testLeads?.length || 0})</span>
          </TabButton>
        </div>

        {tab === "pipeline" && (
          <div className="space-y-2.5">
            {data.pilot.phases.map((p, idx) => {
              const upstreamComplete = idx === 0 || data.pilot.phases.slice(0, idx).every((u) => u.status === "complete");
              const resumable = canEdit && idx > 0 && upstreamComplete;
              return (
                <PhaseCard
                  key={p.key}
                  phase={p as PhaseState}
                  meta={PHASE_TITLES[p.key] || { number: 0, title: p.key, agent: "", description: "" }}
                  canResume={canEdit}
                  resumable={resumable}
                  pipelineRunning={running || busy}
                  onResume={() => {
                    if (!confirm(`Resume the pipeline from "${PHASE_TITLES[p.key]?.title || p.key}"? Phases ${idx + 1}–11 will be re-run; phases 1–${idx} will be reused from saved data.`)) return;
                    startRun({ startFrom: p.key });
                  }}
                />
              );
            })}
          </div>
        )}

        {tab === "inputs" && (
          <InputsForm
            pilotId={pilotId}
            initial={data.pilot.inputs as { targets?: string[]; dnc?: string[]; activeCustomers?: string[]; pastMeetings?: string[]; sellerDomains?: string[] }}
            canEdit={canEdit}
            onSaved={fetchOnce}
          />
        )}

        {tab === "brief" && (
          <BriefForm
            pilotId={pilotId}
            clientName={data.pilot.clientName || "VWO"}
            canEdit={canEdit}
          />
        )}

        {tab === "config" && (
          <ConfigForm
            pilotId={pilotId}
            initial={data.pilot.config as { enrichSubsetCap?: number; topNAfterScore?: number; maxPerIndustry?: number; apolloCreditsBudget?: number; geoFocus?: string; sellerName?: string }}
            eligibleCount={(data.pilot.inputs?.targets as string[] | undefined)?.length || 0}
            canEdit={canEdit}
            pipelineRunning={running || busy}
            onSaved={fetchOnce}
            onSavedAndResume={(startFrom) => startRun({ startFrom })}
          />
        )}

        {tab === "skill" && (
          <SkillForm
            pilotId={pilotId}
            clientName={data.pilot.clientName || "VWO"}
            canEdit={canEdit}
            pipelineRunning={running || busy}
          />
        )}

        {tab === "accounts" && (
          <AccountsTable accounts={data.accounts} />
        )}

        {tab === "leads" && (
          <div className="space-y-3">
            {canEdit && data.accounts.length > 0 && data.leads.length < data.accounts.length && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-900 space-y-2">
                <div className="inline-flex items-start gap-1.5">
                  <Users size={13} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>{data.leads.length} leads, but {data.accounts.length} accounts are scored.</strong> A previous &ldquo;Test run&rdquo; (before isolation was added) wiped most of this list. You can rebuild from the existing accounts — Apollo enrich/email credits are NOT consumed by the default restore (stakeholder phase uses free Apollo people-search).
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap pl-5">
                  <button
                    onClick={() => {
                      if (!confirm(`Restore ${data.accounts.length} accounts' lead names from Apollo people-search?\n\nThis is FREE (no Apollo credits). You'll get firstName, lastName, title, LinkedIn URL — but NOT verified emails. To get emails later, click "Resume from email_match" on the Pipeline tab for the leads you want to contact.\n\nProceed?`)) return;
                      startRun({ startFrom: "stakeholder", stopAfter: "stakeholder" });
                    }}
                    disabled={busy || running}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md"
                  >
                    <Play size={12} /> Restore lead names (free)
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm(`Restore ${data.accounts.length} accounts' leads + verified emails + research + prompts?\n\nThis WILL CONSUME Apollo credits (email match charges ~1 credit per lead). For ${data.accounts.length} accounts × 5 leads each = up to ${data.accounts.length * 5} credits.\n\nIf you want to limit cost, click "Restore lead names" instead and email-match only the subset you want.\n\nProceed with full restore?`)) return;
                      startRun({ startFrom: "stakeholder" });
                    }}
                    disabled={busy || running}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-400 text-amber-800 hover:bg-amber-50 disabled:opacity-50 text-xs font-semibold rounded-md"
                  >
                    <Play size={12} /> Full restore (uses credits)
                  </button>
                </div>
              </div>
            )}
            <LeadsTable leads={data.leads} pilotId={pilotId} onChanged={fetchOnce} />
          </div>
        )}

        {tab === "testLeads" && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 inline-flex items-start gap-1.5">
              <FlaskConical size={13} className="mt-0.5 shrink-0" />
              <span>
                <strong>Test leads</strong> from "Test run (10)" iterations. Fully isolated from the production Leads tab — auto-generate, paste mode, and XLSX download all stay scoped here.
                {(data.testLeads?.length || 0) > 0 && (
                  <a href={`/api/outbound/pilots/${pilotId}/xlsx?test=1`} className="ml-2 underline font-semibold hover:text-amber-900">Download test .xlsx</a>
                )}
              </span>
            </div>
            {(data.testLeads?.length || 0) === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                <FlaskConical size={20} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No test leads yet</p>
                <p className="text-xs text-slate-500 mt-1">Click <strong>&ldquo;Test run (10)&rdquo;</strong> at the top to generate 10 leads here without touching the production Leads tab.</p>
              </div>
            ) : (
              <LeadsTable leads={data.testLeads || []} pilotId={pilotId} onChanged={fetchOnce} isTest />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">{value}</p>
      {sublabel && <p className="text-[10px] text-slate-500 mt-0.5">{sublabel}</p>}
    </div>
  );
}

function TabButton({ children, active, onClick, icon }: { children: React.ReactNode; active: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${active ? "text-[#6800FF] border-[#6800FF]" : "text-slate-500 border-transparent hover:text-slate-800"}`}>
      {icon} {children}
    </button>
  );
}

