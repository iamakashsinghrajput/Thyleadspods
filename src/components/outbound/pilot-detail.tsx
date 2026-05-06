"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Play, Loader2, Download, Upload, FileText, Users, Sliders, BookOpen, Briefcase, Square, FlaskConical, AlertTriangle, Check, X, Sparkles, Search, AlertCircle } from "lucide-react";
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

type Tab = "pipeline" | "inputs" | "brief" | "config" | "skill" | "accounts" | "leads" | "testLeads" | "agentAngle";

export default function PilotDetailView({ pilotId, onBack, canEdit }: { pilotId: string; onBack: () => void; canEdit: boolean }) {
  const { user } = useAuth();
  const [data, setData] = useState<PilotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pipeline");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [justTriggeredAt, setJustTriggeredAt] = useState<number>(0);

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
    const isRunning = !!running || data.pilot.status === "running";
    const recentTrigger = justTriggeredAt > 0 && Date.now() - justTriggeredAt < 30_000;
    if (!isRunning && !recentTrigger) return;
    const intervalMs = recentTrigger && !isRunning ? 800 : 2000;
    const t = setInterval(fetchOnce, intervalMs);
    return () => clearInterval(t);
  }, [data, fetchOnce, justTriggeredAt]);

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
    setJustTriggeredAt(Date.now());
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, actorEmail: user.email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || `Stop failed (${res.status})`);
        setJustTriggeredAt(0);
        return;
      }
      fetchOnce();
    } finally { setBusy(false); }
  }

  async function unstick() {
    if (!user) return;
    if (!confirm("Force-unstick the pilot? Use this only if Stop didn't work (process killed externally / DB stuck in 'running'). All running-status phases will be marked failed; you can then click Resume from any phase.")) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}/unstick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, actorEmail: user.email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || `Unstick failed (${res.status})`);
        return;
      }
      setJustTriggeredAt(0);
      fetchOnce();
    } finally { setBusy(false); }
  }

  async function startRun(opts: { stopAfter?: string; startFrom?: string; testLimit?: number; phase8AccountLimit?: number; forceRegenerate?: boolean; accountLimit?: number; personalize?: boolean } = {}) {
    if (!user) return;
    setBusy(true); setErr(null);
    setJustTriggeredAt(Date.now());
    if (data) {
      setData({
        ...data,
        pilot: {
          ...data.pilot,
          status: "running",
          phases: data.pilot.phases.map((p) => {
            if (opts.startFrom && p.key === opts.startFrom) return { ...p, status: "running", startedAt: new Date().toISOString() };
            if (!opts.startFrom && p.key === "ingest") return { ...p, status: "running", startedAt: new Date().toISOString() };
            return p;
          }),
        },
      });
    }
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorRole: user.role,
          ...(opts.stopAfter ? { stopAfter: opts.stopAfter } : {}),
          ...(opts.startFrom ? { startFrom: opts.startFrom } : {}),
          ...(opts.testLimit ? { testLimit: opts.testLimit } : {}),
          ...(opts.phase8AccountLimit ? { phase8AccountLimit: opts.phase8AccountLimit } : {}),
          ...(opts.forceRegenerate ? { forceRegenerate: true } : {}),
          ...(opts.accountLimit ? { accountLimit: opts.accountLimit } : {}),
          ...(opts.personalize ? { personalize: true } : {}),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || `Run failed (${res.status})`);
        setJustTriggeredAt(0);
        fetchOnce();
        return;
      }
      fetchOnce();
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
                  <>
                    <button
                      onClick={stopRun} disabled={busy}
                      title="Stop the running pipeline. Halts at the next phase or batch boundary (~30s)."
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      <Square size={13} className="fill-white" /> Stop
                    </button>
                    <button
                      onClick={unstick} disabled={busy}
                      title="Use only if Stop didn't work (e.g., dev server was killed and the DB is stuck on 'running'). Marks running-status phases as failed and unlocks the UI."
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-amber-400 hover:bg-amber-50 text-amber-700 disabled:opacity-50 text-xs font-semibold rounded-lg transition-colors"
                    >
                      <AlertTriangle size={12} /> Force unstick
                    </button>
                  </>
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

        <IntegrationStatusPanel />

        <div className="flex items-center gap-1 border-b border-slate-200">
          <TabButton active={tab === "pipeline"} onClick={() => setTab("pipeline")} icon={<Play size={13} />}>Pipeline</TabButton>
          <TabButton active={tab === "inputs"} onClick={() => setTab("inputs")} icon={<Upload size={13} />}>Inputs</TabButton>
          <TabButton active={tab === "brief"} onClick={() => setTab("brief")} icon={<Briefcase size={13} />}>Client Brief</TabButton>
          <TabButton active={tab === "config"} onClick={() => setTab("config")} icon={<Sliders size={13} />}>Config</TabButton>
          <TabButton active={tab === "skill"} onClick={() => setTab("skill")} icon={<BookOpen size={13} />}>SKILL.md</TabButton>
          <TabButton active={tab === "accounts"} onClick={() => setTab("accounts")} icon={<FileText size={13} />}>Accounts <span className="ml-1 text-[10px] text-slate-400">({data.accounts.length})</span></TabButton>
          <TabButton active={tab === "leads"} onClick={() => setTab("leads")} icon={<Users size={13} />}>Leads <span className="ml-1 text-[10px] text-slate-400">({data.leads.length})</span></TabButton>
          <TabButton active={tab === "agentAngle"} onClick={() => setTab("agentAngle")} icon={<Sparkles size={13} />}>
            <span className="text-violet-700">Agent angle</span>
          </TabButton>
          <TabButton active={tab === "testLeads"} onClick={() => setTab("testLeads")} icon={<FlaskConical size={13} />}>
            <span className="text-amber-700">Test leads</span>
            <span className="ml-1 text-[10px] text-slate-400">({data.testLeads?.length || 0})</span>
          </TabButton>
        </div>

        {tab === "pipeline" && (
          <div className="space-y-2.5">
            <PipelineProgressBanner phases={data.pilot.phases as PhaseState[]} pilotStatus={data.pilot.status} />
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
            {data.leads.length > 0 && canEdit && (
              <div className={`bg-linear-to-br from-amber-50 to-white border border-amber-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap ${running ? "opacity-70" : ""}`}>
                <div className="text-xs text-amber-900 inline-flex items-start gap-1.5">
                  <FlaskConical size={13} className="mt-0.5 shrink-0 text-amber-700" />
                  <span>
                    <strong>Regenerate observations (Phase 8 → Phase 9)</strong> — re-run research + draft on the top 60 production accounts using fresh Apify + Tavily + Claude planner. Replaces existing observation_angle, top_pain, value_angle, evidence_list, and claudePrompt.
                    {running && <span className="block text-[10px] text-amber-700/80 mt-0.5">Pipeline is currently running — wait for it to finish, or click Stop / Force unstick in the header.</span>}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (!confirm(`Re-run Phase 8 (research) + Phase 9 (draft) on the top 60 production accounts?\n\nWhat happens:\n• Claude planner picks per-account Tavily queries + Apify configs\n• Apify scrapes LinkedIn (company + jobs + named stakeholders)\n• Tavily site-targeted searches against Indian press\n• Sonnet synthesizes per-account observation + buying hypothesis\n• Phase 9 rebuilds claudePrompt for affected leads\n\nCost: ~$2-4 in Apify + Claude credits.\nRuntime: ~5-8 min for 60 accounts.\n\nProceed?`)) return;
                    startRun({ startFrom: "research", phase8AccountLimit: 60, forceRegenerate: true });
                  }}
                  disabled={busy || running}
                  title={running ? "Pipeline is running — wait or stop it first" : "Regenerate observations for the top 60 accounts"}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md whitespace-nowrap"
                >
                  <Play size={12} /> Regenerate observations (60)
                </button>
              </div>
            )}
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

        {tab === "agentAngle" && (
          <AgentAngleTab
            leads={data.leads}
            testLeads={data.testLeads || []}
            canEdit={canEdit}
            running={running || busy}
            onRegenerate={() => {
              if (!confirm(`Re-run Phase 8 (research) + Phase 9 (draft) on the top 60 production accounts?\n\nWhat happens:\n• Claude planner picks per-account Tavily queries + Apify configs\n• Apify scrapes LinkedIn (company + jobs + named stakeholders)\n• Tavily site-targeted searches against Indian press\n• Sonnet synthesizes per-account observation + buying hypothesis\n• Phase 9 rebuilds claudePrompt for affected leads\n\nCost: ~$2-4 in Apify + Claude credits.\nRuntime: ~5-8 min for 60 accounts.\n\nProceed?`)) return;
              startRun({ startFrom: "research", phase8AccountLimit: 60, forceRegenerate: true, personalize: true });
            }}
            onTest5x5={() => {
              if (!confirm(`Run a full pipeline FROM SCRATCH on 5 accounts × 5 ICPs = up to 25 leads.\n\nIsolation: writes to the __test bucket. Your production Leads tab (60+ leads) stays completely untouched.\n\nWhat happens (phases 1 → 11):\n  1-3. Ingest, filter, subset (test-mode subset)\n  4. Apollo enrich (5 accounts)\n  5. Score (top 5)\n  6. Stakeholder discovery — up to 5 ICPs per account (founder/CEO/CMO/CTO/etc.) = up to 25 leads\n  7. Email match (Apollo bulk)\n  8. Per-account research (Tavily + Apify + Claude) PLUS per-lead personalize (Apify LinkedIn + Haiku synthesis): observation angle, top pain, value angle, social angle, evidence, person evidence, ICP role\n  9-10. Compile prompts + validate\n  11. Export Smartlead CSV\n\nIf a pipeline is already running, STOP it first (Stop button in header, or Force unstick if stale).\n\nCost: ~$2-3 in Apollo + Apify + Claude credits.\nRuntime: ~5-8 min.\n\nResults appear in this Agent angle tab — toggle to "Test bucket" to see them.\n\nProceed?`)) return;
              startRun({ testLimit: 5, personalize: true, forceRegenerate: true });
            }}
          />
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
              <TestLeadsEmptyState
                testAccountsCount={data.testAccounts?.length || 0}
                phases={data.pilot.phases as PhaseState[]}
                canEdit={canEdit}
                running={running || busy}
                onTestRun={() => startRun({ testLimit: 10 })}
              />
            ) : (
              <LeadsTable leads={data.testLeads || []} pilotId={pilotId} onChanged={fetchOnce} isTest />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BucketToggle({ bucket, setBucket, prodCount, testCount }: { bucket: "prod" | "test"; setBucket: (b: "prod" | "test") => void; prodCount: number; testCount: number }) {
  return (
    <div className="inline-flex items-center bg-white border border-violet-200 rounded-md overflow-hidden text-[11px]">
      <button
        type="button"
        onClick={() => setBucket("prod")}
        className={`px-2 py-1 font-semibold ${bucket === "prod" ? "bg-violet-100 text-violet-900" : "text-slate-600 hover:bg-slate-50"}`}
      >
        Production ({prodCount})
      </button>
      <div className="w-px bg-violet-200 self-stretch" />
      <button
        type="button"
        onClick={() => setBucket("test")}
        className={`px-2 py-1 font-semibold ${bucket === "test" ? "bg-violet-100 text-violet-900" : "text-slate-600 hover:bg-slate-50"}`}
      >
        Test bucket ({testCount})
      </button>
    </div>
  );
}

function AgentAngleTab({ leads, testLeads, canEdit, running, onRegenerate, onTest5x5 }: { leads: import("./types").PilotLeadRow[]; testLeads: import("./types").PilotLeadRow[]; canEdit: boolean; running: boolean; onRegenerate: () => void; onTest5x5: () => void }) {
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<"prod" | "test">(testLeads.length > 0 ? "test" : "prod");
  const activeLeads = bucket === "test" ? testLeads : leads;

  const grouped = useMemo(() => {
    const map = new Map<string, import("./types").PilotLeadRow[]>();
    for (const l of activeLeads) {
      const d = (l.accountDomain || "").toLowerCase();
      if (!d) continue;
      const arr = map.get(d) || [];
      arr.push(l);
      map.set(d, arr);
    }
    return Array.from(map.entries()).map(([domain, ls]) => ({ domain, leads: ls }));
  }, [activeLeads]);

  const angleCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of activeLeads) {
      const key = (l.observationAngle || "").trim().toLowerCase();
      if (!key) continue;
      m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
  }, [activeLeads]);

  const stats = useMemo(() => {
    const totalLeads = activeLeads.length;
    const totalAccounts = grouped.length;
    const withAngle = activeLeads.filter((l) => (l.observationAngle || "").trim()).length;
    const withSocial = activeLeads.filter((l) => (l.socialAngle || "").trim()).length;
    const uniqueAngles = angleCounts.size;
    const duplicates = Array.from(angleCounts.values()).filter((c) => c > 1).reduce((sum, c) => sum + c, 0);
    const uniquenessPct = withAngle > 0 ? Math.round((uniqueAngles / withAngle) * 100) : 0;
    return { totalLeads, totalAccounts, withAngle, withSocial, uniqueAngles, duplicates, uniquenessPct };
  }, [activeLeads, grouped, angleCounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grouped;
    return grouped
      .map((g) => ({
        ...g,
        leads: g.leads.filter((l) =>
          (l.companyShort || "").toLowerCase().includes(q) ||
          (l.accountDomain || "").toLowerCase().includes(q) ||
          (l.industry || "").toLowerCase().includes(q) ||
          (l.fullName || "").toLowerCase().includes(q) ||
          (l.contactTitle || "").toLowerCase().includes(q) ||
          (l.icpRole || "").toLowerCase().includes(q) ||
          (l.observationAngle || "").toLowerCase().includes(q) ||
          (l.topPain || "").toLowerCase().includes(q) ||
          (l.valueAngle || "").toLowerCase().includes(q) ||
          (l.socialAngle || "").toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.leads.length > 0);
  }, [grouped, search]);

  if (activeLeads.length === 0) {
    return (
      <div className="space-y-3">
        <div className="bg-linear-to-br from-violet-50 to-white border border-violet-200 rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-violet-900 inline-flex items-start gap-1.5">
              <Sparkles size={13} className="mt-0.5 shrink-0 text-violet-700" />
              <span>
                <strong>Agent angle</strong> — per-lead personalization combining account observation + person LinkedIn social proof. Each lead gets its own observation, top pain, value angle, and social angle tailored to their ICP role.
              </span>
            </div>
            {(leads.length > 0 || testLeads.length > 0) && (
              <BucketToggle bucket={bucket} setBucket={setBucket} prodCount={leads.length} testCount={testLeads.length} />
            )}
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-8 text-center">
          <Sparkles size={24} className="text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No agent observations in {bucket === "test" ? "test bucket" : "production"} yet</p>
          <p className="text-xs text-slate-500 mt-1 mb-3">Click below to run a focused 5×5 test (5 accounts × up to 5 ICPs) — writes to the __test bucket, your production data stays untouched.</p>
          {canEdit && (
            <button
              onClick={onTest5x5}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md"
            >
              <Play size={12} /> Test 5×5 (25 leads)
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-linear-to-br from-violet-50 to-white border border-violet-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-violet-900 inline-flex items-start gap-1.5">
          <Sparkles size={13} className="mt-0.5 shrink-0 text-violet-700" />
          <span>
            <strong>Agent angle</strong> — per-lead personalization. Each row shows the lead's own observation angle, top pain, value angle, and social angle (from their LinkedIn). Grouped by account; duplicates flagged in red.
            {running && <span className="block text-[10px] text-violet-700/80 mt-0.5">Pipeline is currently running.</span>}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BucketToggle bucket={bucket} setBucket={setBucket} prodCount={leads.length} testCount={testLeads.length} />
        {canEdit && (
          <>
            <button
              onClick={onTest5x5}
              disabled={running}
              title={running ? "Pipeline is running — wait or stop it first" : "Run 5 accounts × 5 ICPs = up to 25 personalized leads"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md whitespace-nowrap"
            >
              <Play size={12} /> Test 5×5 (25 leads)
            </button>
            <button
              onClick={onRegenerate}
              disabled={running}
              title={running ? "Pipeline is running" : "Regenerate observations + personalization on top 60 accounts"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-violet-50 border border-violet-300 text-violet-700 text-xs font-semibold rounded-md whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={12} /> Regenerate (60)
            </button>
          </>
        )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <StatTile label="Accounts" value={String(stats.totalAccounts)} />
        <StatTile label="Leads" value={String(stats.totalLeads)} />
        <StatTile label="With angle" value={String(stats.withAngle)} sublabel={`${stats.totalLeads > 0 ? Math.round((stats.withAngle / stats.totalLeads) * 100) : 0}%`} />
        <StatTile label="With social" value={String(stats.withSocial)} sublabel={`${stats.totalLeads > 0 ? Math.round((stats.withSocial / stats.totalLeads) * 100) : 0}%`} />
        <StatTile label="Unique angles" value={String(stats.uniqueAngles)} />
        <StatTile label="Uniqueness" value={`${stats.uniquenessPct}%`} sublabel={stats.uniquenessPct >= 80 ? "good" : stats.uniquenessPct >= 50 ? "ok" : "low"} />
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by company, person, ICP role, or angle text…"
          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((g) => {
          const acc = g.leads[0];
          return (
            <div key={g.domain} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 text-sm truncate">{acc.companyShort || g.domain}</div>
                  <div className="text-[10px] text-slate-500 truncate">{g.domain} · {acc.industry || "—"}</div>
                </div>
                <div className="text-[10px] text-slate-600 font-medium">{g.leads.length} lead{g.leads.length === 1 ? "" : "s"}</div>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-white border-b border-slate-100">
                  <tr>
                    <th className="text-left px-2.5 py-1.5 font-semibold text-slate-500 w-[16%]">Person · ICP</th>
                    <th className="text-left px-2.5 py-1.5 font-semibold text-slate-500 w-[24%]">Observation</th>
                    <th className="text-left px-2.5 py-1.5 font-semibold text-slate-500 w-[16%]">Top pain</th>
                    <th className="text-left px-2.5 py-1.5 font-semibold text-slate-500 w-[18%]">Value angle</th>
                    <th className="text-left px-2.5 py-1.5 font-semibold text-slate-500 w-[18%]">Social angle</th>
                    <th className="text-left px-2.5 py-1.5 font-semibold text-slate-500 w-[8%]">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {g.leads.map((l) => {
                    const angleKey = (l.observationAngle || "").trim().toLowerCase();
                    const isDup = angleKey && (angleCounts.get(angleKey) || 0) > 1;
                    return (
                      <tr key={l.personKey || l.fullName} className={`border-t border-slate-100 align-top ${isDup ? "bg-red-50/30" : ""}`}>
                        <td className="px-2.5 py-2">
                          <div className="font-semibold text-slate-900 truncate">{l.fullName || "—"}</div>
                          <div className="text-[10px] text-slate-500 truncate">{l.contactTitle || "—"}</div>
                          {l.icpRole && (
                            <div className="mt-0.5 inline-flex items-center px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[9px] font-semibold">{l.icpRole}</div>
                          )}
                          {l.contactLinkedinUrl && (
                            <a href={l.contactLinkedinUrl} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-blue-600 hover:underline mt-0.5 truncate">LinkedIn</a>
                          )}
                          {isDup && (
                            <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-semibold">
                              <AlertCircle size={9} /> dup ×{angleCounts.get(angleKey)}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-slate-700 leading-snug">{l.observationAngle || <span className="text-slate-400 italic">—</span>}</td>
                        <td className="px-2.5 py-2 text-slate-700 leading-snug">{l.topPain || <span className="text-slate-400 italic">—</span>}</td>
                        <td className="px-2.5 py-2 text-slate-700 leading-snug">{l.valueAngle || <span className="text-slate-400 italic">—</span>}</td>
                        <td className="px-2.5 py-2 text-slate-700 leading-snug">
                          {l.socialAngle ? l.socialAngle : <span className="text-slate-400 italic">no LinkedIn data</span>}
                          {l.personEvidence && l.personEvidence.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-violet-700 font-semibold text-[10px]">person evidence ({l.personEvidence.length})</summary>
                              <ul className="mt-0.5 space-y-0.5 list-disc list-inside text-[10px] text-slate-600">
                                {l.personEvidence.map((e, i) => <li key={i}>{e}</li>)}
                              </ul>
                            </details>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-slate-600">
                          {l.evidenceList && l.evidenceList.length > 0 ? (
                            <details>
                              <summary className="cursor-pointer text-violet-700 font-semibold">{l.evidenceList.length}</summary>
                              <ul className="mt-1 space-y-0.5 list-disc list-inside text-[10px] text-slate-600">
                                {l.evidenceList.map((e, i) => <li key={i}>{e}</li>)}
                              </ul>
                            </details>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="border border-slate-200 rounded-lg px-3 py-6 text-center text-xs text-slate-500">No leads match "{search}".</div>
        )}
      </div>
    </div>
  );
}

function TestLeadsEmptyState({ testAccountsCount, phases, canEdit, running, onTestRun }: { testAccountsCount: number; phases: PhaseState[]; canEdit: boolean; running: boolean; onTestRun: () => void }) {
  const stakeholderPhase = phases.find((p) => p.key === "stakeholder");
  const enrichPhase = phases.find((p) => p.key === "enrich");
  const scorePhase = phases.find((p) => p.key === "score");

  let diagnosis = "";
  let nextAction = "";
  if (testAccountsCount === 0 && (!enrichPhase || enrichPhase.status === "pending")) {
    diagnosis = "Test bucket is completely empty. No test run has been started.";
    nextAction = "Click 'Test run (10)' below to fan out the full pipeline on 10 leads.";
  } else if (enrichPhase?.status === "running" || stakeholderPhase?.status === "running" || scorePhase?.status === "running") {
    diagnosis = "Test pipeline is currently running — leads will appear once the stakeholder phase completes.";
    nextAction = "Wait. Watch the Pipeline tab for progress.";
  } else if (enrichPhase?.status === "failed" || scorePhase?.status === "failed" || stakeholderPhase?.status === "failed") {
    const failedKey = [enrichPhase, scorePhase, stakeholderPhase].find((p) => p?.status === "failed")?.key;
    diagnosis = `Test pipeline failed at the ${failedKey} phase.`;
    nextAction = "Check the Pipeline tab → click 'Retry' on the failed card.";
  } else if (testAccountsCount > 0 && stakeholderPhase?.status !== "complete") {
    diagnosis = `${testAccountsCount} test accounts are ranked, but the stakeholder phase hasn't run yet.`;
    nextAction = "On the Pipeline tab, click 'Resume from here' on the Stakeholder card.";
  } else if (testAccountsCount > 0 && stakeholderPhase?.status === "complete") {
    diagnosis = `${testAccountsCount} test accounts and stakeholder phase complete, but no leads written. Possible Phase 6 failure.`;
    nextAction = "Open Pipeline tab → expand the Stakeholder card → check the log for errors.";
  } else {
    diagnosis = "Test bucket is empty.";
    nextAction = "Click 'Test run (10)' below to start a fresh test run.";
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
        <FlaskConical size={20} className="mx-auto text-slate-300" />
        <p className="text-sm font-bold text-slate-700">No test leads yet</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{diagnosis}</p>
        <p className="text-[11px] text-slate-600 max-w-md mx-auto"><strong>Next:</strong> {nextAction}</p>
        {canEdit && testAccountsCount === 0 && !running && (
          <button
            onClick={onTestRun}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg"
          >
            <Play size={13} /> Test run (10)
          </button>
        )}
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 space-y-1">
        <p className="font-bold text-slate-700">Diagnostic snapshot</p>
        <p className="font-mono">testAccounts: {testAccountsCount} · enrich: {enrichPhase?.status || "—"} · score: {scorePhase?.status || "—"} · stakeholder: {stakeholderPhase?.status || "—"}</p>
      </div>
    </div>
  );
}

function PipelineProgressBanner({ phases, pilotStatus }: { phases: PhaseState[]; pilotStatus: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const total = phases.length || 11;
  const completed = phases.filter((p) => p.status === "complete").length;
  const runningPhase = phases.find((p) => p.status === "running");
  const failedPhase = phases.find((p) => p.status === "failed");
  const lastCompleted = [...phases].reverse().find((p) => p.status === "complete");
  const nextPending = phases.find((p) => p.status === "pending");

  const runningMeta = runningPhase ? PHASE_TITLES[runningPhase.key] : null;
  const failedMeta = failedPhase ? PHASE_TITLES[failedPhase.key] : null;
  const lastMeta = lastCompleted ? PHASE_TITLES[lastCompleted.key] : null;
  const nextMeta = nextPending ? PHASE_TITLES[nextPending.key] : null;

  function fmtDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m ${rem}s`;
  }

  if (runningPhase && runningMeta) {
    const startedAt = runningPhase.startedAt ? new Date(runningPhase.startedAt).getTime() : Date.now();
    const elapsed = Date.now() - startedAt;
    const phaseLabel = `Phase ${runningMeta.number} of ${total}`;
    const justFinishedLine = lastCompleted && lastMeta
      ? `Just completed: Phase ${lastMeta.number} (${lastMeta.title}) in ${fmtDuration(lastCompleted.durationMs || 0)} →`
      : "Pipeline started →";
    return (
      <div className="bg-linear-to-br from-blue-50 to-indigo-50 border border-blue-300 rounded-2xl px-4 py-3 ring-1 ring-blue-100">
        <div className="flex items-center gap-3 flex-wrap">
          <Loader2 size={18} className="text-blue-600 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-blue-700/80 font-semibold uppercase tracking-wider">{justFinishedLine}</p>
            <p className="text-sm font-bold text-blue-900 mt-0.5">
              {phaseLabel} — {runningMeta.title}
            </p>
            <p className="text-[11px] text-blue-700 mt-0.5 tabular-nums">
              Running for {fmtDuration(elapsed)} · {completed}/{total} phases done
              {runningPhase.outputCount > 0 ? ` · ${runningPhase.outputCount.toLocaleString()} processed` : ""}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (failedPhase && failedMeta) {
    return (
      <div className="bg-red-50 border border-red-300 rounded-2xl px-4 py-3 ring-1 ring-red-100">
        <div className="flex items-center gap-3 flex-wrap">
          <X size={18} className="text-red-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-red-700/80 font-semibold uppercase tracking-wider">Pipeline halted</p>
            <p className="text-sm font-bold text-red-900 mt-0.5">
              Failed at Phase {failedMeta.number} — {failedMeta.title}
            </p>
            {failedPhase.error && (
              <p className="text-[11px] text-red-700 mt-0.5 font-mono truncate">{failedPhase.error}</p>
            )}
            <p className="text-[11px] text-red-700 mt-1">
              {completed}/{total} phases completed · click <strong>Retry</strong> on the failed card to resume.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (completed === total && total > 0) {
    const totalMs = phases.reduce((a, p) => a + (p.durationMs || 0), 0);
    return (
      <div className="bg-linear-to-br from-emerald-50 to-green-50 border border-emerald-300 rounded-2xl px-4 py-3 ring-1 ring-emerald-100">
        <div className="flex items-center gap-3 flex-wrap">
          <Check size={18} className="text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-emerald-700/80 font-semibold uppercase tracking-wider">Pipeline complete</p>
            <p className="text-sm font-bold text-emerald-900 mt-0.5">
              All {total} phases completed in {fmtDuration(totalMs)}
            </p>
            <p className="text-[11px] text-emerald-700 mt-0.5">Ready to download leads or open paste mode.</p>
          </div>
        </div>
      </div>
    );
  }

  if (pilotStatus === "paused") {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 ring-1 ring-amber-100">
        <div className="flex items-center gap-3 flex-wrap">
          <Square size={16} className="text-amber-700 fill-amber-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-amber-700/90 font-semibold uppercase tracking-wider">Paused</p>
            <p className="text-sm font-bold text-amber-900 mt-0.5">
              {completed}/{total} phases done · {nextMeta ? `next up: Phase ${nextMeta.number} (${nextMeta.title})` : "all phases done"}
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5">Click <strong>Run from here</strong> on the next pending card to continue.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Play size={16} className="text-slate-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Not started</p>
          <p className="text-sm font-bold text-slate-700 mt-0.5">
            {completed}/{total} phases · click <strong>Run full pipeline</strong> or <strong>Test run (10)</strong> at the top to begin.
          </p>
        </div>
      </div>
    </div>
  );
}

interface IntegrationProbe {
  ok: boolean;
  latencyMs?: number;
  status?: number;
  error?: string;
  detail?: string;
}
interface Integration {
  name: "anthropic" | "tavily" | "coresignal" | "apollo" | "apify";
  envVar: string;
  configured: boolean;
  keyPreview: string;
  baseUrl?: string;
  probe?: IntegrationProbe;
}

const INTEGRATION_LABELS: Record<Integration["name"], { label: string; emoji: string; help: string }> = {
  anthropic: { label: "Claude (Anthropic)", emoji: "C", help: "Used by skill generator, insight strategy, per-account research, auto-generate emails" },
  tavily: { label: "Tavily", emoji: "T", help: "Web search for per-account research (Phase 8)" },
  coresignal: { label: "CoreSignal", emoji: "S", help: "LinkedIn members, jobs, headcount, funding, tech stack (Phase 8)" },
  apollo: { label: "Apollo", emoji: "A", help: "Account enrichment (Phase 4), stakeholder discovery (Phase 6), email match (Phase 7)" },
  apify: { label: "Apify", emoji: "P", help: "LinkedIn / web scraping actors — use when CoreSignal can't reach a profile or for fresh post/comment data" },
};

function IntegrationStatusPanel() {
  const [data, setData] = useState<{ integrations: Integration[]; probedAt: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [err, setErr] = useState("");

  async function load(probe = false) {
    setErr("");
    if (probe) setProbing(true); else setLoading(true);
    try {
      const url = probe ? "/api/outbound/integrations/status?probe=1" : "/api/outbound/integrations/status";
      const res = await fetch(url, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || `Failed (${res.status})`); }
      else { setData(j); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    }
    setLoading(false);
    setProbing(false);
  }

  useEffect(() => { load(false); }, []);

  if (loading || !data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs text-slate-500">
        <Loader2 size={13} className="animate-spin" /> Loading API integrations…
      </div>
    );
  }

  const allConfigured = data.integrations.every((i) => i.configured);
  const anyConfigured = data.integrations.some((i) => i.configured);

  return (
    <div className={`bg-white rounded-xl border p-3 space-y-2 ${allConfigured ? "border-emerald-200" : anyConfigured ? "border-amber-200" : "border-red-200"}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider inline-flex items-center gap-1.5">
          API integrations
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${allConfigured ? "bg-emerald-50 text-emerald-700" : anyConfigured ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
            {data.integrations.filter((i) => i.configured).length}/{data.integrations.length} configured
          </span>
        </p>
        <button
          onClick={() => load(true)}
          disabled={probing}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
          title="Hits each API with a tiny test call to verify the key works end-to-end"
        >
          {probing ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
          {probing ? "Probing…" : "Test connections"}
        </button>
      </div>
      {err && (
        <div className="text-[11px] text-red-700 inline-flex items-center gap-1.5"><AlertTriangle size={11} /> {err}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {data.integrations.map((i) => {
          const meta = INTEGRATION_LABELS[i.name];
          const probeColor = i.probe ? (i.probe.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800") : i.configured ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-slate-50 border-slate-200 text-slate-500";
          return (
            <div key={i.name} className={`rounded-lg border p-2 ${probeColor}`} title={meta.help}>
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-bold tabular-nums">{meta.label}</p>
                <span className="text-[9px] font-bold uppercase tracking-wider">
                  {!i.configured ? "✕ missing" : i.probe ? (i.probe.ok ? "✓ live" : "⚠ error") : "○ set"}
                </span>
              </div>
              <p className="text-[10px] mt-0.5 font-mono">{i.envVar}: {i.configured ? i.keyPreview : "not set"}</p>
              {i.probe && (
                <p className="text-[10px] mt-0.5 tabular-nums">
                  {i.probe.ok
                    ? `${i.probe.latencyMs}ms · ${i.probe.detail || "ok"}`
                    : `${i.probe.status ? `${i.probe.status} · ` : ""}${(i.probe.error || "error").slice(0, 80)}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!allConfigured && (
        <p className="text-[10px] text-slate-500 italic">
          Add missing keys to <code className="font-mono bg-slate-100 px-1 rounded">.env.local</code>, restart the dev server, and click <strong>Test connections</strong> to verify.
        </p>
      )}
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

