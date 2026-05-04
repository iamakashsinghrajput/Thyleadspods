import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";

interface SkillDoc {
  skillContent?: string;
  skillVersion?: string;
  skillUpdatedAt?: Date;
  skillUpdatedBy?: string;
  pilotName?: string;
  clientName?: string;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const doc = await OutboundPilot.findById(id).lean<SkillDoc>();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    skillContent: doc.skillContent || "",
    skillVersion: doc.skillVersion || "v6",
    skillUpdatedAt: doc.skillUpdatedAt || null,
    skillUpdatedBy: doc.skillUpdatedBy || "",
    pilotName: doc.pilotName || "",
    clientName: doc.clientName || "",
    chars: (doc.skillContent || "").length,
    lines: (doc.skillContent || "").split(/\r?\n/).length,
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const skillContent = typeof body.skillContent === "string" ? body.skillContent : "";
  const skillVersion = typeof body.skillVersion === "string" ? body.skillVersion : "v8";
  const skillUpdatedBy = (body.actorEmail || "").toLowerCase();

  if (skillContent.length > 0 && skillContent.length < 200) {
    return NextResponse.json({ error: "skill content too short — paste a full SKILL.md (≥200 chars)" }, { status: 400 });
  }

  await OutboundPilot.findByIdAndUpdate(id, {
    skillContent,
    skillVersion,
    skillUpdatedBy,
    skillUpdatedAt: new Date(),
    updatedAt: new Date(),
  });

  return NextResponse.json({
    ok: true,
    chars: skillContent.length,
    lines: skillContent.split(/\r?\n/).length,
    version: skillVersion,
  });
}
