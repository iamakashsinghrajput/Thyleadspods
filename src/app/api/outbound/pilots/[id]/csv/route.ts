import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";

interface CsvDoc {
  finalCsv?: string;
  pilotName?: string;
  clientName?: string;
}

function clientSlug(s: string): string {
  const slug = (s || "vwo").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return slug || "client";
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const doc = await OutboundPilot.findById(id).lean<CsvDoc>();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!doc.finalCsv) return NextResponse.json({ error: "csv not ready" }, { status: 409 });

  const filename = `${clientSlug(doc.clientName || "vwo")}_pilot_smartlead_ready_v6.csv`;
  return new NextResponse(doc.finalCsv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
