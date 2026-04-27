"use client";

import { useEffect, useState } from "react";
import { use as usePromise } from "react";
import { Loader2, Check, AlertTriangle, Send, X, Plus } from "lucide-react";
import Image from "next/image";
import type { OnboardingFieldDef } from "@/lib/onboarding/form-fields";

interface FormState {
  status: "loading" | "pending" | "submitted" | "expired" | "not_found" | "error";
  clientName: string;
  fields: OnboardingFieldDef[];
  answers: Record<string, unknown>;
  submittedAt?: string | null;
  errorMessage?: string;
}

export default function OnboardingFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  const [state, setState] = useState<FormState>({ status: "loading", clientName: "", fields: [], answers: {} });
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/form/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!ignore) setState({ status: "not_found", clientName: "", fields: [], answers: {} });
          return;
        }
        if (!res.ok) {
          if (!ignore) setState({ status: "error", clientName: "", fields: [], answers: {}, errorMessage: await res.text() });
          return;
        }
        const data = await res.json();
        if (ignore) return;
        const status = data.status === "submitted" ? "submitted" : data.status === "expired" ? "expired" : "pending";
        setState({ status, clientName: data.clientName || "", fields: data.fields || [], answers: data.answers || {}, submittedAt: data.submittedAt });
        if (data.answers) setValues(data.answers as Record<string, unknown>);
      } catch (err) {
        if (!ignore) setState({ status: "error", clientName: "", fields: [], answers: {}, errorMessage: err instanceof Error ? err.message : "unknown" });
      }
    })();
    return () => { ignore = true; };
  }, [token]);

  async function handleSubmit() {
    setSubmitting(true);
    setMissing([]);
    try {
      const res = await fetch(`/api/onboarding/form/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: values }),
      });
      if (res.status === 400) {
        const data = await res.json();
        setMissing((data.missing as string[]) || []);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const errText = await res.text();
        setState((s) => ({ ...s, status: "error", errorMessage: errText }));
        setSubmitting(false);
        return;
      }
      setState((s) => ({ ...s, status: "submitted", submittedAt: new Date().toISOString() }));
    } catch (err) {
      setState((s) => ({ ...s, status: "error", errorMessage: err instanceof Error ? err.message : "unknown" }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 px-4 py-10 sm:py-16">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <Image src="/logo.png" alt="Thyleads" width={32} height={32} className="rounded-lg" />
          <span className="text-base font-bold text-slate-900">Thyleads</span>
          <span className="text-slate-300">·</span>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Client onboarding</span>
        </div>

        {state.status === "loading" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
            <Loader2 size={22} className="text-[#6800FF] animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-3">Loading your form…</p>
          </div>
        )}

        {state.status === "not_found" && <ErrorCard title="Link not recognized" body="This onboarding link isn't valid. Reach out to your Thyleads contact for a fresh one." />}
        {state.status === "expired" && <ErrorCard title="Link expired" body="This onboarding link has expired. Reach out to your Thyleads contact for a fresh one." />}
        {state.status === "error" && <ErrorCard title="Something went wrong" body={state.errorMessage || "Please try again or contact your Thyleads team."} />}

        {state.status === "submitted" && (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 mx-auto flex items-center justify-center">
              <Check size={26} className="text-emerald-700" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-4">Thanks — we&apos;ve got it</h1>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
              {state.clientName ? `${state.clientName}'s` : "Your"} onboarding form is in. The Thyleads GTM Engineer has been notified and will start sourcing accounts.
            </p>
            {state.submittedAt && (
              <p className="text-[11px] text-slate-400 mt-3">Submitted {new Date(state.submittedAt).toLocaleString()}</p>
            )}
          </div>
        )}

        {state.status === "pending" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 sm:px-8 py-6 border-b border-slate-100">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{state.clientName || "Welcome"} — onboarding form</h1>
              <p className="text-sm text-slate-500 mt-1.5">A few inputs that shape every account we look for. ~5 minutes. Required fields marked *.</p>
            </div>
            <div className="px-6 sm:px-8 py-6 space-y-6">
              {state.fields.map((f) => (
                <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} missing={missing.includes(f.key)} />
              ))}
            </div>
            <div className="px-6 sm:px-8 py-5 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-3 flex-wrap">
              {missing.length > 0
                ? <p className="inline-flex items-center gap-1.5 text-xs text-red-700"><AlertTriangle size={13} /> Fill the {missing.length} required field{missing.length !== 1 ? "s" : ""} above.</p>
                : <span />}
              <button onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <><Send size={14} /> Submit form</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 mx-auto flex items-center justify-center">
        <AlertTriangle size={24} className="text-amber-700" />
      </div>
      <h1 className="text-lg font-bold text-slate-900 mt-4">{title}</h1>
      <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">{body}</p>
    </div>
  );
}

function FieldInput({ field, value, onChange, missing }: { field: OnboardingFieldDef; value: unknown; onChange: (v: unknown) => void; missing: boolean }) {
  return (
    <div>
      <label className="block">
        <span className={`text-sm font-bold ${missing ? "text-red-700" : "text-slate-900"}`}>{field.label}{field.required ? <span className="text-red-500"> *</span> : null}</span>
        {field.helper && <span className="block text-xs text-slate-500 mt-0.5">{field.helper}</span>}
      </label>
      <div className="mt-2">
        {field.type === "text" && (
          <input type="text" value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF] ${missing ? "border-red-300" : "border-slate-200"}`} />
        )}
        {field.type === "number" && (
          <input type="number" min={0} value={(value as number) || ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} placeholder={field.placeholder} className={`w-full px-3 py-2 border rounded-lg text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF] ${missing ? "border-red-300" : "border-slate-200"}`} />
        )}
        {field.type === "textarea" && (
          <textarea value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} rows={3} className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF] ${missing ? "border-red-300" : "border-slate-200"}`} />
        )}
        {field.type === "tags" && (
          <TagsInput value={(value as string[]) || []} onChange={(v) => onChange(v)} placeholder={field.placeholder} missing={missing} />
        )}
      </div>
    </div>
  );
}

function TagsInput({ value, onChange, placeholder, missing }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; missing: boolean }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) { setDraft(""); return; }
    onChange([...value, v]);
    setDraft("");
  }
  function remove(i: number) { onChange(value.filter((_, idx) => idx !== i)); }
  return (
    <div className={`border rounded-lg p-2 ${missing ? "border-red-300" : "border-slate-200"} focus-within:ring-2 focus-within:ring-[#6800FF]/20 focus-within:border-[#6800FF]`}>
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-[#f0e6ff] text-[#6800FF] text-xs font-medium rounded-md">
            {tag}
            <button onClick={() => remove(i)} className="p-0.5 hover:bg-[#e0ccff] rounded" type="button"><X size={11} /></button>
          </span>
        ))}
        <div className="flex items-center gap-1 flex-1 min-w-[160px]">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
            else if (e.key === "Backspace" && !draft && value.length > 0) onChange(value.slice(0, -1));
          }} onBlur={add} placeholder={value.length === 0 ? placeholder : "Add another"} className="flex-1 px-1 py-1 text-sm bg-transparent focus:outline-none" />
          {draft.trim() && <button onClick={add} type="button" className="p-1 text-[#6800FF] hover:bg-[#f0e6ff] rounded"><Plus size={12} /></button>}
        </div>
      </div>
    </div>
  );
}
