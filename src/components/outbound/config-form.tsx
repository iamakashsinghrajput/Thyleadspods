"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Sliders, Zap, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface ConfigFormProps {
  pilotId: string;
  initial: {
    enrichSubsetCap?: number;
    topNAfterScore?: number;
    maxPerIndustry?: number;
    apolloCreditsBudget?: number;
    bulkEnrichTopN?: number;
    useFreeSearchFirst?: boolean;
    useAi?: boolean;
    geoFocus?: string;
    sellerName?: string;
  };
  eligibleCount: number;
  canEdit: boolean;
  pipelineRunning: boolean;
  onSaved: () => void;
  onSavedAndResume?: (startFrom: string) => void;
}

interface Preset {
  key: string;
  label: string;
  icon: typeof Target;
  enrichSubsetCap: number;
  topNAfterScore: number;
  maxPerIndustry: number;
  apolloCreditsBudget: number;
  bulkEnrichTopN: number;
  useFreeSearchFirst: boolean;
  blurb: string;
}

const PRESETS: Preset[] = [
  { key: "default",     label: "Default pilot",  icon: Target,     enrichSubsetCap: 1500, topNAfterScore: 500,   maxPerIndustry: 50,  apolloCreditsBudget: 1500, bulkEnrichTopN: 600,  useFreeSearchFirst: true,  blurb: "500 leads · ~800 credits." },
  { key: "wave2",       label: "Wave 2",         icon: TrendingUp, enrichSubsetCap: 3000, topNAfterScore: 1500,  maxPerIndustry: 80,  apolloCreditsBudget: 2500, bulkEnrichTopN: 1000, useFreeSearchFirst: true,  blurb: "1.5K leads · ~1.5K credits." },
  { key: "smartsweep",  label: "Smart sweep",    icon: Zap,        enrichSubsetCap: 6000, topNAfterScore: 5000,  maxPerIndustry: 200, apolloCreditsBudget: 4000, bulkEnrichTopN: 2000, useFreeSearchFirst: true,  blurb: "5K leads · ~3K credits." },
  { key: "maxleads",    label: "Maximum leads",  icon: Zap,        enrichSubsetCap: 6000, topNAfterScore: 10000, maxPerIndustry: 500, apolloCreditsBudget: 8000, bulkEnrichTopN: 4000, useFreeSearchFirst: true,  blurb: "ALL eligible · ~6K credits." },
];

export default function ConfigForm({ pilotId, initial, eligibleCount, canEdit, pipelineRunning, onSaved, onSavedAndResume }: ConfigFormProps) {
  const { user } = useAuth();
  const [enrichSubsetCap, setEnrichSubsetCap] = useState(initial.enrichSubsetCap || 600);
  const [topNAfterScore, setTopNAfterScore] = useState(initial.topNAfterScore || 50);
  const [maxPerIndustry, setMaxPerIndustry] = useState(initial.maxPerIndustry || 12);
  const [apolloCreditsBudget, setApolloCreditsBudget] = useState(initial.apolloCreditsBudget || 700);
  const [bulkEnrichTopN, setBulkEnrichTopN] = useState(initial.bulkEnrichTopN ?? 600);
  const [useFreeSearchFirst, setUseFreeSearchFirst] = useState(initial.useFreeSearchFirst !== false);
  const [useAi, setUseAi] = useState(initial.useAi === true);
  const [geoFocus, setGeoFocus] = useState(initial.geoFocus || "India");
  const [sellerName, setSellerName] = useState(initial.sellerName || "VWO");
  const [busy, setBusy] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setEnrichSubsetCap(initial.enrichSubsetCap || 600);
    setTopNAfterScore(initial.topNAfterScore || 50);
    setMaxPerIndustry(initial.maxPerIndustry || 12);
    setApolloCreditsBudget(initial.apolloCreditsBudget || 700);
    setBulkEnrichTopN(initial.bulkEnrichTopN ?? 600);
    setUseFreeSearchFirst(initial.useFreeSearchFirst !== false);
    setUseAi(initial.useAi === true);
    setGeoFocus(initial.geoFocus || "India");
    setSellerName(initial.sellerName || "VWO");
  }, [initial]);

  function applyPreset(p: Preset) {
    setEnrichSubsetCap(p.enrichSubsetCap);
    setTopNAfterScore(p.topNAfterScore);
    setMaxPerIndustry(p.maxPerIndustry);
    setApolloCreditsBudget(p.apolloCreditsBudget);
    setBulkEnrichTopN(p.bulkEnrichTopN);
    setUseFreeSearchFirst(p.useFreeSearchFirst);
  }

  const projection = useMemo(() => {
    const subsetActual = Math.min(enrichSubsetCap, eligibleCount || enrichSubsetCap);
    const searchHitsEstimate = useFreeSearchFirst ? Math.round(subsetActual * 0.6) : 0;
    const enrichTarget = Math.min(useFreeSearchFirst ? bulkEnrichTopN : subsetActual, searchHitsEstimate || subsetActual);
    const enrichEstimate = Math.round(enrichTarget * 0.73);
    const topEstimate = Math.min(topNAfterScore, useFreeSearchFirst ? searchHitsEstimate : enrichEstimate);
    const emailCreditsEstimate = topEstimate;
    const totalCreditsEstimate = enrichEstimate + emailCreditsEstimate;
    const overBudget = totalCreditsEstimate > apolloCreditsBudget;
    return { subsetActual, searchHitsEstimate, enrichTarget, enrichEstimate, topEstimate, emailCreditsEstimate, totalCreditsEstimate, overBudget };
  }, [enrichSubsetCap, topNAfterScore, apolloCreditsBudget, bulkEnrichTopN, useFreeSearchFirst, eligibleCount]);

  async function save(resume: boolean) {
    if (!user) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorRole: user.role,
          config: {
            enrichSubsetCap,
            topNAfterScore,
            maxPerIndustry,
            apolloCreditsBudget,
            bulkEnrichTopN,
            useFreeSearchFirst,
            useAi,
            geoFocus,
            sellerName,
          },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || `Save failed (${res.status})`);
        return;
      }
      setSavedTick((n) => n + 1);
      onSaved();
      if (resume && onSavedAndResume) {
        setTimeout(() => onSavedAndResume("subset"), 250);
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sliders size={14} className="text-[#6800FF]" />
          <p className="text-sm font-bold text-slate-900">Pipeline caps</p>
        </div>
        <p className="text-[11px] text-slate-500 mb-4">Three numbers control how many leads come out the other end. Bigger numbers = more leads = more Apollo credits.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const active = p.enrichSubsetCap === enrichSubsetCap && p.topNAfterScore === topNAfterScore && p.maxPerIndustry === maxPerIndustry && p.apolloCreditsBudget === apolloCreditsBudget;
            return (
              <button
                key={p.key}
                onClick={() => applyPreset(p)}
                disabled={!canEdit}
                className={`text-left rounded-lg p-3 border transition-colors ${active ? "border-[#6800FF] bg-[#f0e6ff] ring-1 ring-[#6800FF]/20" : "border-slate-200 bg-white hover:border-slate-300"} ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={12} className={active ? "text-[#6800FF]" : "text-slate-500"} />
                  <p className={`text-xs font-bold ${active ? "text-[#6800FF]" : "text-slate-800"}`}>{p.label}</p>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{p.enrichSubsetCap.toLocaleString()} → {p.topNAfterScore.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{p.blurb}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumField label="Subset cap (search pool)" sub="Domains processed via free Apollo search" value={enrichSubsetCap} onChange={setEnrichSubsetCap} disabled={!canEdit} step={100} min={50} max={20000} />
          <NumField label="Bulk-enrich top N (paid)" sub="Of those, how many to bulk_enrich for richer data" value={bulkEnrichTopN} onChange={setBulkEnrichTopN} disabled={!canEdit} step={50} min={0} max={20000} />
          <NumField label="Top N after scoring" sub="How many leads survive scoring (each costs ~1 Apollo credit in Phase 7 email match)" value={topNAfterScore} onChange={setTopNAfterScore} disabled={!canEdit} step={50} min={5} max={20000} />
          <NumField label="Max per industry" sub="Diversity guard — max leads from one industry" value={maxPerIndustry} onChange={setMaxPerIndustry} disabled={!canEdit} step={1} min={1} max={500} />
          <NumField label="Apollo credits budget" sub="Hard ceiling on Apollo spend per run" value={apolloCreditsBudget} onChange={setApolloCreditsBudget} disabled={!canEdit} step={100} min={50} max={50000} />
          <ToggleField label="Free-search first" sub="Use Apollo's free search to pre-qualify, then bulk_enrich top N (recommended)" checked={useFreeSearchFirst} onChange={setUseFreeSearchFirst} disabled={!canEdit} />
          <ToggleField label="Use AI personalization" sub="ON = Claude + Tavily for per-lead variation (~$50–200 per 5K-lead pilot). OFF = deterministic v9 templates with per-lead variables (firstName, company, segment-matched brands). The iQuanta winner shape is preserved either way." checked={useAi} onChange={setUseAi} disabled={!canEdit} />
          <TextField label="Geo focus" sub="Country prioritized in scoring" value={geoFocus} onChange={setGeoFocus} disabled={!canEdit} />
          <TextField label="Seller name" sub="Used in social-proof line and CSV filename" value={sellerName} onChange={setSellerName} disabled={!canEdit} />
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Projected funnel for this pilot</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Tile label="Eligible" value={String(eligibleCount || "—")} sub="after Phase 2 filter" />
          <Tile label={useFreeSearchFirst ? "Free search hits (est.)" : "Subset"} value={String(useFreeSearchFirst ? projection.searchHitsEstimate : projection.subsetActual)} sub={useFreeSearchFirst ? `0 credits · cap ${enrichSubsetCap.toLocaleString()}` : `capped at ${enrichSubsetCap.toLocaleString()}`} />
          <Tile label="Top leads" value={String(projection.topEstimate)} sub={`capped at ${topNAfterScore.toLocaleString()}`} />
          <Tile label="Apollo credits (est.)" value={`~${projection.totalCreditsEstimate}`} sub={`enrich ${projection.enrichEstimate} + emails ${projection.emailCreditsEstimate}`} warn={projection.overBudget} />
        </div>
        {projection.overBudget && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2 inline-flex items-start gap-1.5">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            Estimated credits ({projection.totalCreditsEstimate}) exceed your budget cap ({apolloCreditsBudget}). The pipeline will stop early at the budget — bump the budget or shrink the subset.
          </p>
        )}
      </div>

      {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{err}</p>}
      {savedTick > 0 && !err && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">Config saved.</p>}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => save(false)} disabled={busy} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 text-sm font-semibold rounded-lg transition-colors">
            {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save config</>}
          </button>
          <button onClick={() => save(true)} disabled={busy || pipelineRunning} title={pipelineRunning ? "Wait for current run to finish" : "Save and re-run from Phase 3 (Subset) so the new caps take effect"} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors">
            {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Zap size={13} /> Save & re-run from Phase 3</>}
          </button>
        </div>
      )}
    </div>
  );
}

function NumField({ label, sub, value, onChange, disabled, step, min, max }: { label: string; sub: string; value: number; onChange: (v: number) => void; disabled?: boolean; step: number; min: number; max: number }) {
  return (
    <label className="block bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-slate-800">{label}</span>
        <span className="text-[10px] tabular-nums text-slate-400">{value.toLocaleString()}</span>
      </div>
      <p className="text-[11px] text-slate-500 mt-0.5 mb-2">{sub}</p>
      <input type="number" value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))} disabled={disabled} step={step} min={min} max={max} className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-mono focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15 disabled:bg-slate-50" />
    </label>
  );
}

function ToggleField({ label, sub, checked, onChange, disabled }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-start gap-3">
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`shrink-0 w-9 h-5 rounded-full relative transition-colors ${checked ? "bg-[#6800FF]" : "bg-slate-300"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={`absolute top-0.5 ${checked ? "right-0.5" : "left-0.5"} w-4 h-4 rounded-full bg-white shadow transition-all`} />
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold text-slate-800">{label}</span>
        <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function TextField({ label, sub, value, onChange, disabled }: { label: string; sub: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="block bg-white border border-slate-200 rounded-xl p-3">
      <span className="text-xs font-bold text-slate-800">{label}</span>
      <p className="text-[11px] text-slate-500 mt-0.5 mb-2">{sub}</p>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15 disabled:bg-slate-50" />
    </label>
  );
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-3 ${warn ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"}`}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${warn ? "text-amber-700" : "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}
