"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, BookOpen, FileText, Eye, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface SkillFormProps {
  pilotId: string;
  clientName: string;
  pipelineRunning: boolean;
  canEdit: boolean;
}

interface SkillState {
  skillContent: string;
  skillVersion: string;
  skillUpdatedAt: string | null;
  skillUpdatedBy: string;
  chars: number;
  lines: number;
}

export default function SkillForm({ pilotId, clientName, pipelineRunning, canEdit }: SkillFormProps) {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<SkillState | null>(null);
  const [skillContent, setSkillContent] = useState("");
  const [skillVersion, setSkillVersion] = useState("v8");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/outbound/pilots/${pilotId}/skill`, { cache: "no-store" });
        const d = (await res.json()) as SkillState;
        if (!ignore) {
          setLoaded(d);
          setSkillContent(d.skillContent || "");
          setSkillVersion(d.skillVersion || "v8");
        }
      } catch {
        if (!ignore) setErr("Failed to load skill content.");
      }
    })();
    return () => { ignore = true; };
  }, [pilotId]);

  async function save() {
    if (!user) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}/skill`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorRole: user.role,
          actorEmail: user.email,
          skillContent,
          skillVersion,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || `Save failed (${res.status})`);
        return;
      }
      setSavedTick((n) => n + 1);
      setLoaded((prev) => prev ? { ...prev, skillContent, skillVersion, chars: d.chars, lines: d.lines, skillUpdatedAt: new Date().toISOString(), skillUpdatedBy: user.email } : null);
    } finally { setBusy(false); }
  }

  const chars = skillContent.length;
  const lines = skillContent.split(/\r?\n/).length;
  const dirty = loaded ? skillContent !== loaded.skillContent || skillVersion !== loaded.skillVersion : skillContent.length > 0;

  return (
    <div className="space-y-4">
      <div className="bg-linear-to-br from-[#f8f5ff] to-white rounded-2xl border border-[#6800FF]/20 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-[#6800FF]/10 text-[#6800FF] flex items-center justify-center">
            <BookOpen size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">Per-client SKILL for {clientName}</p>
            <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
              This is the system prompt fed to Claude Opus during Phase 9 (draft). Every email body, every subject, every validation rule the LLM applies is sourced from THIS document. Each pilot has its own SKILL — what works for {clientName} doesn&apos;t leak into another client&apos;s campaigns.
            </p>
            {loaded?.skillContent ? (
              <p className="text-[11px] text-slate-500 mt-2">
                <strong className="text-slate-700">Active</strong> · version <code className="bg-white px-1 py-0.5 rounded border border-slate-200">{loaded.skillVersion}</code>
                {loaded.skillUpdatedAt && <> · last edited {new Date(loaded.skillUpdatedAt).toLocaleString()}</>}
                {loaded.skillUpdatedBy && <> by <code className="bg-white px-1 py-0.5 rounded border border-slate-200">{loaded.skillUpdatedBy}</code></>}
                {" · "} {loaded.chars.toLocaleString()} chars · {loaded.lines.toLocaleString()} lines
              </p>
            ) : (
              <p className="text-[11px] text-amber-700 mt-2 inline-flex items-center gap-1">
                No custom SKILL set yet — the pipeline is using the built-in v6 fallback. Paste your SKILL.md below to override.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={() => setTab("edit")} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "edit" ? "bg-white border border-slate-200 text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              <Pencil size={11} /> Edit
            </button>
            <button onClick={() => setTab("preview")} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "preview" ? "bg-white border border-slate-200 text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              <Eye size={11} /> Preview
            </button>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-500 tabular-nums">
            <label className="inline-flex items-center gap-1">
              <span>version:</span>
              <input
                type="text"
                value={skillVersion}
                onChange={(e) => setSkillVersion(e.target.value)}
                disabled={!canEdit}
                className="w-12 px-1.5 py-0.5 border border-slate-200 rounded font-mono text-[10px] focus:outline-none focus:border-[#6800FF]"
              />
            </label>
            <span>{chars.toLocaleString()} chars</span>
            <span>{lines.toLocaleString()} lines</span>
            {dirty && <span className="text-amber-600 font-bold">● UNSAVED</span>}
          </div>
        </div>

        {tab === "edit" ? (
          <textarea
            value={skillContent}
            onChange={(e) => setSkillContent(e.target.value)}
            disabled={!canEdit || pipelineRunning}
            rows={28}
            placeholder="---&#10;name: india-cold-email&#10;description: ...&#10;---&#10;&#10;# India Cold Email — paste the SKILL.md content here…"
            className="w-full px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-800 focus:outline-none disabled:bg-slate-50 resize-y"
          />
        ) : (
          <div className="px-4 py-3 max-h-[640px] overflow-auto">
            {skillContent.trim() ? (
              <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-slate-700">{skillContent}</pre>
            ) : (
              <p className="text-[11px] text-slate-400 italic flex items-center gap-1.5"><FileText size={11} /> Empty — start typing in the Edit tab.</p>
            )}
          </div>
        )}
      </div>

      {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{err}</p>}
      {savedTick > 0 && !err && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">Saved. Phase 9 will use this on the next run.</p>}

      {canEdit && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={save} disabled={busy || !dirty} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors">
            {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save SKILL for {clientName}</>}
          </button>
          {dirty && loaded && (
            <button
              onClick={() => { setSkillContent(loaded.skillContent || ""); setSkillVersion(loaded.skillVersion || "v8"); }}
              disabled={busy}
              className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors"
            >
              Discard changes
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">
        <strong>How this is applied:</strong> When you click <strong>&ldquo;Project instructions (.md)&rdquo;</strong> in the pilot header, this SKILL is bundled together with the Client Brief into one Markdown file you paste into a Claude Pro Project. Every per-lead prompt then runs against this SKILL because the project instructions stay loaded across all chats in that project. Re-saving here changes what your next downloaded Project Instructions file contains.
      </p>
    </div>
  );
}
