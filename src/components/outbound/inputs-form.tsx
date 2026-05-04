"use client";

import { useState } from "react";
import { Loader2, Save, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface InputsFormProps {
  pilotId: string;
  initial: { targets?: string[]; dnc?: string[]; activeCustomers?: string[]; pastMeetings?: string[]; sellerDomains?: string[] };
  canEdit: boolean;
  onSaved: () => void;
}

export default function InputsForm({ pilotId, initial, canEdit, onSaved }: InputsFormProps) {
  const { user } = useAuth();
  const [targets, setTargets] = useState((initial.targets || []).join("\n"));
  const [dnc, setDnc] = useState((initial.dnc || []).join("\n"));
  const [active, setActive] = useState((initial.activeCustomers || []).join("\n"));
  const [past, setPast] = useState((initial.pastMeetings || []).join("\n"));
  const [seller, setSeller] = useState((initial.sellerDomains || []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<{ targets: number; dnc: number; activeCustomers: number; pastMeetings: number; sellerDomains: number } | null>(null);

  async function save() {
    if (!user) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}/inputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorRole: user.role,
          rawTargets: targets,
          rawDnc: dnc,
          rawActiveCustomers: active,
          rawPastMeetings: past,
          rawSellerDomains: seller,
        }),
      });
      const d = await res.json();
      if (res.ok) setCounts(d.counts);
      onSaved();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <FileText size={14} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-blue-900">How to populate</p>
          <p className="text-[11px] text-blue-800 mt-1">Paste one entry per line (or comma-separated). Domains accept any of <code className="font-mono bg-white px-1 rounded">razorpay.com</code>, <code className="font-mono bg-white px-1 rounded">https://razorpay.com/</code>, <code className="font-mono bg-white px-1 rounded">www.razorpay.com</code>. The ingest agent normalises and deduplicates.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FieldArea label="Target accounts" sub="Domain list — the universe to score." value={targets} onChange={setTargets} disabled={!canEdit} placeholder="razorpay.com&#10;cred.club&#10;..." />
        <FieldArea label="DNC list" sub="Domains already prospected — exclude." value={dnc} onChange={setDnc} disabled={!canEdit} placeholder="example.com&#10;..." />
        <FieldArea label="Active customers" sub="Currently paying customers — never prospect." value={active} onChange={setActive} disabled={!canEdit} placeholder="bigbasket.com&#10;..." />
        <FieldArea label="Past meetings" sub="Company names from last 12 months — exclude by name match." value={past} onChange={setPast} disabled={!canEdit} placeholder="Razorpay&#10;BharatPe&#10;..." />
        <FieldArea label="Seller's own domains" sub="Self-exclude — never reach out to yourself." value={seller} onChange={setSeller} disabled={!canEdit} placeholder="vwo.com&#10;wingify.com" />
      </div>

      {counts && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-emerald-700">Saved</span>
          <span>targets <strong>{counts.targets}</strong></span>
          <span>DNC <strong>{counts.dnc}</strong></span>
          <span>active <strong>{counts.activeCustomers}</strong></span>
          <span>past <strong>{counts.pastMeetings}</strong></span>
          <span>self <strong>{counts.sellerDomains}</strong></span>
        </div>
      )}

      {canEdit && (
        <div>
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors">
            {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save inputs</>}
          </button>
        </div>
      )}
    </div>
  );
}

function FieldArea({ label, sub, value, onChange, disabled, placeholder }: { label: string; sub: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  const lineCount = value.split(/\r?\n/).filter((l) => l.trim()).length;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-xs font-bold text-slate-800">{label}</p>
        <p className="text-[10px] text-slate-500 tabular-nums">{lineCount} entries</p>
      </div>
      <p className="text-[11px] text-slate-500 mb-2">{sub}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={8}
        className="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs font-mono leading-relaxed focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15 disabled:bg-slate-50"
      />
    </div>
  );
}
