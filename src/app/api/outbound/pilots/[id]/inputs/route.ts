import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";
import { ingestAgent } from "@/lib/outbound/agents/phase1-ingest";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { output } = ingestAgent({
    rawTargets: String(body.rawTargets || ""),
    rawDnc: String(body.rawDnc || ""),
    rawActiveCustomers: String(body.rawActiveCustomers || ""),
    rawPastMeetings: String(body.rawPastMeetings || ""),
    rawSellerDomains: String(body.rawSellerDomains || ""),
  });

  await OutboundPilot.findByIdAndUpdate(id, {
    inputs: {
      targets: output.targets,
      dnc: output.dnc,
      activeCustomers: output.activeCustomers,
      pastMeetings: output.pastMeetings,
      sellerDomains: output.sellerDomains,
      pastMeetingTokens: output.pastMeetingTokens,
    },
    updatedAt: new Date(),
  });

  return NextResponse.json({
    counts: {
      targets: output.targets.length,
      dnc: output.dnc.length,
      activeCustomers: output.activeCustomers.length,
      pastMeetings: output.pastMeetings.length,
      sellerDomains: output.sellerDomains.length,
    },
  });
}
