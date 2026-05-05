import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundLead from "@/lib/models/outbound/lead";

export const maxDuration = 30;

interface FullLead {
  accountDomain: string;
  personKey: string;
  claudePrompt: string;
  subject1: string; body1: string;
  subject2: string; body2: string;
  subject3: string; body3: string;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const isTest = req.nextUrl.searchParams.get("test") === "1";
  const dataPilotId = isTest ? `${id}__test` : id;
  const accountDomain = (req.nextUrl.searchParams.get("accountDomain") || "").toLowerCase().trim();
  const personKey = (req.nextUrl.searchParams.get("personKey") || "").trim();
  const keysParam = req.nextUrl.searchParams.get("keys");

  const projection = {
    accountDomain: 1, personKey: 1,
    claudePrompt: 1,
    subject1: 1, body1: 1,
    subject2: 1, body2: 1,
    subject3: 1, body3: 1,
  };

  if (accountDomain && personKey) {
    const doc = await OutboundLead.findOne({ pilotId: dataPilotId, accountDomain, personKey }).select(projection).lean<FullLead>();
    if (!doc) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json({ lead: doc });
  }

  if (keysParam) {
    const pairs = keysParam.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
      const [d, p] = s.split("::");
      return { domain: (d || "").toLowerCase(), personKey: p || "" };
    });
    const limited = pairs.slice(0, 50);
    if (limited.length === 0) return NextResponse.json({ leads: [] });
    const docs = (await OutboundLead.find({
      pilotId: dataPilotId,
      $or: limited.map((p) => ({ accountDomain: p.domain, personKey: p.personKey })),
    }).select(projection).lean()) as unknown as FullLead[];
    return NextResponse.json({ leads: docs });
  }

  return NextResponse.json({ error: "either (accountDomain + personKey) or keys=<domain>::<personKey>,... required" }, { status: 400 });
}
