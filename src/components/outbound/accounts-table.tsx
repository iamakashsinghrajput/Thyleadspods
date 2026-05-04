"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PilotAccountRow } from "./types";

export default function AccountsTable({ accounts }: { accounts: PilotAccountRow[] }) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return accounts;
    return accounts.filter((a) =>
      a.domain.toLowerCase().includes(s) ||
      a.name.toLowerCase().includes(s) ||
      a.industry.toLowerCase().includes(s)
    );
  }, [accounts, q]);

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
        <p className="text-sm font-bold text-slate-700">No accounts yet</p>
        <p className="text-xs text-slate-500 mt-1">Run the enrich phase to populate accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by domain, name, or industry…"
          className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2">Rank</th>
              <th className="text-left px-3 py-2">Domain</th>
              <th className="text-left px-3 py-2">Industry</th>
              <th className="text-left px-3 py-2">Country</th>
              <th className="text-right px-3 py-2">Employees</th>
              <th className="text-right px-3 py-2">Score</th>
              <th className="text-left px-3 py-2">Segment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.slice(0, 200).map((a) => (
              <tr key={a.domain} className="hover:bg-slate-50">
                <td className="px-3 py-2 tabular-nums text-slate-500">{a.rank > 0 ? `#${a.rank}` : "—"}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-900">{a.name || a.domain}</p>
                  <p className="text-[10px] text-slate-400">{a.domain}</p>
                </td>
                <td className="px-3 py-2 text-slate-600">{a.industry}</td>
                <td className="px-3 py-2 text-slate-600">{a.country}</td>
                <td className="px-3 py-2 tabular-nums text-right text-slate-600">{a.employees || "—"}</td>
                <td className="px-3 py-2 tabular-nums text-right font-bold text-slate-900">{a.score}</td>
                <td className="px-3 py-2"><SegmentBadge segment={a.segment} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length > 200 && <p className="px-3 py-2 text-[10px] text-slate-400 bg-slate-50">Showing first 200 of {visible.length}</p>}
      </div>
    </div>
  );
}

function SegmentBadge({ segment }: { segment: string }) {
  const cls =
    segment === "hot" ? "bg-red-100 text-red-700" :
    segment === "priority" ? "bg-emerald-100 text-emerald-700" :
    segment === "active" ? "bg-blue-100 text-blue-700" :
    segment === "nurture" ? "bg-amber-100 text-amber-700" :
    segment === "excluded" ? "bg-slate-100 text-slate-500" :
    "bg-slate-100 text-slate-500";
  return <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}>{segment || "—"}</span>;
}
