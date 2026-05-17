import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AccountsDailySnapshot from "@/lib/models/accounts-daily-snapshot";

type SnapshotDoc = {
  date: string;
  totalRows: number;
  uniqueDomains: number;
  newRows?: number;
  newDomains?: number;
  newDomainsList?: string[];
  newRowsList?: string[];
  allDomains?: string[];
  allRows?: string[];
  recordedAt?: Date;
};

function ymdDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const projectId = (req.nextUrl.searchParams.get("projectId") || "").trim();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  const days = Math.min(60, Math.max(1, Number(req.nextUrl.searchParams.get("days") || 14)));

  await connectDB();
  const since = ymdDaysAgo(days);
  const docs = await AccountsDailySnapshot
    .find({ projectId, date: { $gte: since } })
    .sort({ date: 1 })
    .lean<SnapshotDoc[]>();

  const byDate = new Map<string, SnapshotDoc>();
  for (const d of docs) byDate.set(d.date, d);

  type SeriesEntry = {
    date: string;
    totalRows: number;
    uniqueDomains: number;
    newRows: number;
    newDomains: number;
    newDomainsList: string[];
    newRowsList: string[];
    listAvailable: boolean;
    isFilled?: boolean;
  };

  const series: SeriesEntry[] = [];
  let priorDomains: Set<string> | null = null;
  let priorRows: Set<string> | null = null;
  let priorUniqueDomains: number | null = null;
  let priorTotalRows: number | null = null;
  let lastKnown: SnapshotDoc | null = null;

  for (let i = days - 1; i >= 0; i--) {
    const date = ymdDaysAgo(i);
    const found = byDate.get(date);
    if (found) {
      const hasAllDomains = (found.allDomains?.length ?? 0) > 0;
      const hasAllRows = (found.allRows?.length ?? 0) > 0;

      let newDomainsList: string[] = [];
      let newRowsList: string[] = [];
      let newDomains = 0;
      let newRows = 0;
      let listAvailable = false;

      if (priorDomains && hasAllDomains) {
        newDomainsList = (found.allDomains || []).filter((d) => !priorDomains!.has(d)).sort();
        newDomains = newDomainsList.length;
        listAvailable = true;
      } else if (priorUniqueDomains !== null) {
        newDomains = Math.max(0, found.uniqueDomains - priorUniqueDomains);
      } else {
        newDomains = found.newDomains ?? 0;
        if ((found.newDomainsList?.length ?? 0) > 0) {
          newDomainsList = (found.newDomainsList || []).slice().sort();
          listAvailable = true;
        }
      }

      if (priorRows && hasAllRows) {
        newRowsList = (found.allRows || []).filter((r) => !priorRows!.has(r)).sort();
        newRows = newRowsList.length;
      } else if (priorTotalRows !== null) {
        newRows = Math.max(0, found.totalRows - priorTotalRows);
      } else {
        newRows = found.newRows ?? 0;
        if ((found.newRowsList?.length ?? 0) > 0) {
          newRowsList = (found.newRowsList || []).slice().sort();
        }
      }

      series.push({
        date,
        totalRows: found.totalRows,
        uniqueDomains: found.uniqueDomains,
        newRows,
        newDomains,
        newDomainsList,
        newRowsList,
        listAvailable,
      });

      if (hasAllDomains) priorDomains = new Set(found.allDomains);
      if (hasAllRows) priorRows = new Set(found.allRows);
      priorUniqueDomains = found.uniqueDomains;
      priorTotalRows = found.totalRows;
      lastKnown = found;
    } else {
      series.push({
        date,
        totalRows: lastKnown?.totalRows ?? 0,
        uniqueDomains: lastKnown?.uniqueDomains ?? 0,
        newRows: 0,
        newDomains: 0,
        newDomainsList: [],
        newRowsList: [],
        listAvailable: false,
        isFilled: true,
      });
    }
  }

  const latest = series[series.length - 1];
  const yesterday = series[series.length - 2];
  return NextResponse.json({
    days,
    series,
    today: latest || null,
    yesterday: yesterday || null,
    totalAddedInWindow: series.reduce((s, d) => s + d.newDomains, 0),
  });
}
