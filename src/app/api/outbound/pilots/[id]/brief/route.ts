import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";

interface BriefDoc {
  clientBrief?: {
    sellerProduct?: string;
    sellerOneLineValue?: string;
    sellerCapabilities?: string[];
    sellerUsps?: string[];
    targetSegments?: string[];
    targetPersonas?: string[];
    commonPainsSolved?: string[];
    caseStudyWins?: string[];
    antiIcp?: string[];
    notes?: string;
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const doc = await OutboundPilot.findById(id).lean<BriefDoc>();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  const b = doc.clientBrief || {};
  return NextResponse.json({
    sellerProduct: b.sellerProduct || "",
    sellerOneLineValue: b.sellerOneLineValue || "",
    sellerCapabilities: b.sellerCapabilities || [],
    sellerUsps: b.sellerUsps || [],
    targetSegments: b.targetSegments || [],
    targetPersonas: b.targetPersonas || [],
    commonPainsSolved: b.commonPainsSolved || [],
    caseStudyWins: b.caseStudyWins || [],
    antiIcp: b.antiIcp || [],
    notes: b.notes || "",
  });
}

function sanitizeList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const clientBrief = {
    sellerProduct: typeof body.sellerProduct === "string" ? body.sellerProduct.trim() : "",
    sellerOneLineValue: typeof body.sellerOneLineValue === "string" ? body.sellerOneLineValue.trim() : "",
    sellerCapabilities: sanitizeList(body.sellerCapabilities),
    sellerUsps: sanitizeList(body.sellerUsps),
    targetSegments: sanitizeList(body.targetSegments),
    targetPersonas: sanitizeList(body.targetPersonas),
    commonPainsSolved: sanitizeList(body.commonPainsSolved),
    caseStudyWins: sanitizeList(body.caseStudyWins),
    antiIcp: sanitizeList(body.antiIcp),
    notes: typeof body.notes === "string" ? body.notes : "",
  };
  await OutboundPilot.findByIdAndUpdate(id, { clientBrief, updatedAt: new Date() });
  return NextResponse.json({ ok: true });
}
