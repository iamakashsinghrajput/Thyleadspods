"use client";

import { useState } from "react";
import { Loader2, Check, X, Clock, ChevronDown, ChevronUp, Bot, AlertCircle, Play, RotateCcw } from "lucide-react";
import type { PhaseState } from "@/lib/outbound/types";

interface PhaseCardProps {
  phase: PhaseState;
  meta: { number: number; title: string; agent: string; description: string };
  canResume?: boolean;
  resumable?: boolean;
  pipelineRunning?: boolean;
  onResume?: () => void;
}

export default function PhaseCard({ phase, meta, canResume, resumable, pipelineRunning, onResume }: PhaseCardProps) {
  const [open, setOpen] = useState(phase.status === "running" || phase.status === "failed");

  const statusIcon = (() => {
    if (phase.status === "running") return <Loader2 size={14} className="text-blue-500 animate-spin" />;
    if (phase.status === "complete") return <Check size={14} className="text-emerald-500" />;
    if (phase.status === "failed") return <X size={14} className="text-red-500" />;
    return <Clock size={14} className="text-slate-400" />;
  })();

  const statusLabel = (() => {
    if (phase.status === "running") return "Running";
    if (phase.status === "complete") return "Complete";
    if (phase.status === "failed") return "Failed";
    return "Pending";
  })();

  const statusBg = (() => {
    if (phase.status === "running") return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    if (phase.status === "complete") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    if (phase.status === "failed") return "bg-red-50 text-red-700 ring-1 ring-red-200";
    return "bg-slate-50 text-slate-600 ring-1 ring-slate-200";
  })();

  const accentBorder = (() => {
    if (phase.status === "running") return "border-blue-400";
    if (phase.status === "complete") return "border-emerald-400";
    if (phase.status === "failed") return "border-red-400";
    return "border-slate-200";
  })();

  return (
    <div className={`bg-white rounded-2xl border-l-4 ${accentBorder} border-y border-r border-slate-200 transition-colors`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left p-4 cursor-pointer">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-linear-to-br from-[#f0e6ff] to-[#fafaff] text-[#6800FF] flex items-center justify-center font-bold text-sm">
              {meta.number}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 truncate">{meta.title}</h3>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusBg}`}>
                  {statusIcon} {statusLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                  <Bot size={10} /> {meta.agent}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{meta.description}</p>

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {phase.inputCount > 0 && <Metric label="In" value={phase.inputCount} />}
                {phase.outputCount > 0 && <Metric label="Out" value={phase.outputCount} />}
                {phase.durationMs > 0 && <Metric label="Time" value={`${(phase.durationMs / 1000).toFixed(1)}s`} />}
                {phase.apolloCreditsUsed > 0 && <Metric label="Apollo" value={phase.apolloCreditsUsed} />}
                {(phase.llmTokensIn > 0 || phase.llmTokensOut > 0) && <Metric label="Tokens" value={`${phase.llmTokensIn}/${phase.llmTokensOut}`} />}
              </div>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            {canResume && resumable && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); if (!pipelineRunning) onResume?.(); }}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !pipelineRunning) { e.stopPropagation(); onResume?.(); } }}
                title={pipelineRunning ? "Wait for current run to finish" : `Run pipeline starting from ${meta.title}`}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-semibold transition-colors ${pipelineRunning ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed" : phase.status === "failed" ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 cursor-pointer" : "bg-[#f0e6ff] text-[#6800FF] border-[#6800FF]/20 hover:bg-[#e6d6ff] cursor-pointer"}`}
              >
                {phase.status === "failed" ? <RotateCcw size={11} /> : <Play size={11} />}
                {phase.status === "failed" ? "Retry" : "Run from here"}
              </span>
            )}
            <span className="text-slate-400">
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {phase.error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Error</p>
                <p className="text-xs text-red-700 font-mono mt-1 break-all">{phase.error}</p>
              </div>
            </div>
          )}

          {Object.keys(phase.metrics || {}).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Metrics</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {Object.entries(phase.metrics || {}).map(([k, v]) => (
                  <div key={k} className="bg-slate-50 border border-slate-100 rounded px-2 py-1.5">
                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider truncate">{k}</p>
                    <p className="text-xs font-bold text-slate-900 tabular-nums">{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase.log && phase.log.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Agent log</p>
              <div className="bg-slate-900 rounded-lg p-3 font-mono text-[11px] leading-relaxed text-slate-200 space-y-1 max-h-64 overflow-auto">
                {phase.log.map((line, i) => (
                  <div key={i}>
                    <span className="text-slate-500">›</span> {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
            {phase.startedAt && <span>Started: {new Date(phase.startedAt).toLocaleTimeString()}</span>}
            {phase.completedAt && <span>Finished: {new Date(phase.completedAt).toLocaleTimeString()}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="inline-flex items-center gap-1 text-[10px]">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold text-slate-700 tabular-nums">{value}</span>
    </div>
  );
}
