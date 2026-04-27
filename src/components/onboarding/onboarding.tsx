"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Inbox, Filter, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { STAGES, type ClientStatus } from "@/lib/onboarding/stages";
import ClientCard from "./client-card";
import type { OnboardingClientDoc } from "./types";

const STAGE_ACCENT: Record<ClientStatus, string> = {
  new_client: "text-slate-700 bg-slate-100",
  form_pending: "text-amber-700 bg-amber-100",
  form_received: "text-blue-700 bg-blue-100",
  accounts_in_progress: "text-purple-700 bg-purple-100",
  awaiting_approval: "text-orange-700 bg-orange-100",
  data_team_extracting: "text-indigo-700 bg-indigo-100",
  ready: "text-emerald-700 bg-emerald-100",
};

export default function OnboardingDashboard() {
  const { user } = useAuth();
  const canEdit = user?.role === "superadmin" || user?.role === "admin";
  const [clients, setClients] = useState<OnboardingClientDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<ClientStatus | "all">("all");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/clients", { cache: "no-store" });
        const data = await res.json();
        if (!ignore) setClients((data.clients || []) as OnboardingClientDoc[]);
      } catch {
        if (!ignore) setClients([]);
      }
      if (!ignore) setLoading(false);
    })();
    return () => { ignore = true; };
  }, [tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const stats = useMemo(() => {
    const counts: Record<ClientStatus, number> = {
      new_client: 0, form_pending: 0, form_received: 0, accounts_in_progress: 0,
      awaiting_approval: 0, data_team_extracting: 0, ready: 0,
    };
    for (const c of clients) counts[c.status] = (counts[c.status] || 0) + 1;
    return counts;
  }, [clients]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (stageFilter !== "all" && c.status !== stageFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.contactEmail.toLowerCase().includes(q) ||
        c.ownerEmail.toLowerCase().includes(q) ||
        c.icp.toLowerCase().includes(q)
      );
    });
  }, [clients, search, stageFilter]);

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Onboarding</h1>
            <p className="text-sm text-slate-500 mt-0.5">Track each client from kickoff form to enriched contacts. One row per client, expand to see the next action.</p>
          </div>
          {canEdit && (
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6800FF] hover:bg-[#5800DD] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
              <Plus size={14} /> New client
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStageFilter(stageFilter === s.key ? "all" : s.key)}
              className={`bg-white rounded-xl border p-3 text-left transition-colors hover:border-[#6800FF]/40 ${stageFilter === s.key ? "border-[#6800FF] ring-1 ring-[#6800FF]/20" : "border-slate-200"}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${STAGE_ACCENT[s.key]}`}>{s.shortLabel}</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">{stats[s.key]}</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{s.label}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client name, email, or ICP…"
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15"
            />
          </div>
          {stageFilter !== "all" && (
            <button onClick={() => setStageFilter("all")} className="inline-flex items-center gap-1 px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
              <Filter size={12} /> {STAGES.find((s) => s.key === stageFilter)?.label}
              <X size={11} />
            </button>
          )}
        </div>

        {showCreate && canEdit && (
          <CreateClientForm
            onCreated={() => { setShowCreate(false); refresh(); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="text-[#6800FF] animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center mb-3">
              <Inbox size={20} className="text-slate-500" />
            </div>
            <p className="text-sm font-bold text-slate-700">{clients.length === 0 ? "No clients yet" : "No matches"}</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {clients.length === 0
                ? "Add a client to kick off the onboarding flow — they'll get a form, you'll source accounts, the data team will enrich contacts."
                : "Try clearing the search or stage filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visible.map((c) => (
              <ClientCard key={c.id} client={c} onChanged={refresh} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateClientForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [ownerEmail, setOwnerEmail] = useState(user?.email || "");
  const [dataTeamEmail, setDataTeamEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!user) return;
    if (!name.trim()) { setErr("Client name is required."); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorRole: user.role,
          createdBy: user.email,
          name: name.trim(),
          contactEmail: contactEmail.trim(),
          ownerEmail: ownerEmail.trim(),
          dataTeamEmail: dataTeamEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || `Failed (${res.status})`);
        return;
      }
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#6800FF]/30 ring-1 ring-[#6800FF]/10 p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">New client</p>
        <button onClick={onCancel} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={14} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client name *</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client contact email</span>
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contact@acme.com" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GTM Engineer email</span>
          <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="gtme@thyleads.com" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data Team email</span>
          <input type="email" value={dataTeamEmail} onChange={(e) => setDataTeamEmail(e.target.value)} placeholder="data@thyleads.com" className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15" />
        </label>
      </div>
      {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{err}</p>}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={busy || !name.trim()} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors">
          {busy ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : <><Plus size={13} /> Create client</>}
        </button>
        <button onClick={onCancel} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg">Cancel</button>
      </div>
    </div>
  );
}
