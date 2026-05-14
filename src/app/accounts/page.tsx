"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { Building2, Search, Loader2, ArrowRight, RefreshCw, FileSpreadsheet, ShieldOff, Globe, FileX2 } from "lucide-react";
import { resolveProjectLogo } from "@/lib/client-logo";

type ClientCard = {
  projectId: string;
  clientId: string;
  clientName: string;
  websiteUrl: string;
  logoUrl: string;
  uploaded: number;
  uniqueDomains: number;
  dncCount: number;
  hasSheet: boolean;
  originalFileName: string;
  updatedAt: string | null;
};

function fmtRelative(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const m = Math.round(diffMs / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AccountsClientsPage() {
  const { user, hydrated } = useAuth();
  const [cards, setCards] = useState<ClientCard[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const canAccess = !!user && ["admin", "superadmin"].includes(user.role);

  const fetchCards = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/accounts/clients?actor=${encodeURIComponent(user.email)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to load clients"); return; }
      setCards(json.cards || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => { if (canAccess) void fetchCards(); }, [canAccess, fetchCards]);

  const filteredCards = useMemo(() => {
    if (!cards) return [];
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => c.clientName.toLowerCase().includes(q) || c.clientId.toLowerCase().includes(q));
  }, [cards, search]);

  const totals = useMemo(() => {
    const list = cards || [];
    return {
      clients: list.length,
      uploaded: list.reduce((s, c) => s + c.uploaded, 0),
      uniqueDomains: list.reduce((s, c) => s + c.uniqueDomains, 0),
      withSheet: list.filter((c) => c.hasSheet).length,
    };
  }, [cards]);

  if (!hydrated) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (!canAccess) {
    return <div className="p-8"><p className="text-sm text-slate-600">You don&apos;t have access to Account Details.</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="px-6 pt-6 pb-4 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Account Details</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Click a client to manage their Target Account List, DNC list, and uploaded sheet.
            </p>
          </div>
          <button
            onClick={() => fetchCards()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-5">
          <SummaryCard icon={<Building2 size={14} />} label="Clients" value={totals.clients} tint="violet" />
          <SummaryCard icon={<FileSpreadsheet size={14} />} label="With Sheet Uploaded" value={totals.withSheet} tint="emerald" />
          <SummaryCard icon={<Globe size={14} />} label="Total Accounts" value={totals.uploaded} tint="slate" />
          <SummaryCard icon={<ShieldOff size={14} />} label="Unique Domains" value={totals.uniqueDomains} tint="amber" />
        </div>

        <div className="flex items-center justify-end mt-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client…"
              className="w-64 pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-400">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading clients…
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">{error}</div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">
            <Building2 size={22} className="text-slate-300 mx-auto mb-2" />
            {cards && cards.length > 0 ? "No clients match your search." : "No clients available yet."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCards.map((c) => <ClientAccountCard key={c.projectId} card={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: number; tint: "slate" | "emerald" | "violet" | "amber" }) {
  const tones: Record<typeof tint, { bg: string; text: string; iconBg: string }> = {
    slate: { bg: "bg-slate-50", text: "text-slate-900", iconBg: "bg-slate-100 text-slate-600" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100 text-emerald-600" },
    violet: { bg: "bg-violet-50", text: "text-violet-700", iconBg: "bg-violet-100 text-violet-600" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", iconBg: "bg-amber-100 text-amber-600" },
  };
  const t = tones[tint];
  return (
    <div className={`${t.bg} border border-slate-200 rounded-lg px-3 py-2.5 flex items-center gap-3`}>
      <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${t.iconBg}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`text-base font-bold tabular-nums ${t.text}`}>{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function ClientAccountCard({ card }: { card: ClientCard }) {
  const logo = resolveProjectLogo({ clientName: card.clientName, websiteUrl: card.websiteUrl, logoUrl: card.logoUrl });
  const initial = (card.clientName || "?").trim().charAt(0).toUpperCase();
  return (
    <Link
      href={`/accounts/${encodeURIComponent(card.projectId)}`}
      className="group bg-white border border-slate-200 rounded-2xl p-5 transition-all hover:border-[#6800FF]/40 hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden">
            {logo ? (
              <Image src={logo} alt={card.clientName} width={40} height={40} className="object-contain" unoptimized />
            ) : (
              <span className="text-lg font-bold text-slate-500">{initial}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-slate-900 truncate">{card.clientName || "Unnamed"}</h3>
            <p className="text-[11px] text-slate-400 font-mono">{card.clientId || card.projectId}</p>
          </div>
        </div>
        <ArrowRight size={16} className="text-slate-300 group-hover:text-[#6800FF] group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>

      {card.hasSheet ? (
        <>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Metric label="Accounts" value={card.uploaded} />
            <Metric label="Unique" value={card.uniqueDomains} accent="violet" />
            <Metric label="DNC" value={card.dncCount} accent="rose" />
          </div>
          <p className="mt-3 text-[10.5px] text-slate-400">
            Updated {fmtRelative(card.updatedAt)}
            {card.originalFileName ? <> · <span className="font-mono">{card.originalFileName}</span></> : null}
          </p>
        </>
      ) : (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
          <FileX2 size={12} />
          No sheet uploaded yet
        </div>
      )}
    </Link>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: "violet" | "rose" }) {
  const color = accent === "violet" ? "text-[#6800FF]" : accent === "rose" ? "text-rose-600" : "text-slate-900";
  return (
    <div>
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-[15px] font-bold tabular-nums ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}
