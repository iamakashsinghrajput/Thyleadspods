import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";

export const maxDuration = 30;

async function readMasterSkill(): Promise<{ content: string; sourcePath: string } | { error: string }> {
  const candidates = [
    process.env.MASTER_SKILL_PATH,
    path.join(process.cwd(), "SKILL.md"),
    path.join(process.cwd(), "..", "SKILL.md"),
  ].filter((p): p is string => !!p);

  for (const p of candidates) {
    try {
      const stat = await fs.stat(p);
      if (!stat.isFile()) continue;
      const content = await fs.readFile(p, "utf8");
      if (content.trim().length < 200) continue;
      return { content, sourcePath: p };
    } catch { continue; }
  }
  return { error: `Master SKILL.md not found in any of: ${candidates.join(", ")}` };
}

export async function GET() {
  const r = await readMasterSkill();
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 404 });
  return NextResponse.json({
    sourcePath: r.sourcePath,
    chars: r.content.length,
    lines: r.content.split(/\r?\n/).length,
    preview: r.content.slice(0, 800),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const actorRole = (body.actorRole || "").toLowerCase();
  const actorEmail = (body.actorEmail || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const r = await readMasterSkill();
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 404 });

  const update = {
    skillContent: r.content,
    skillVersion: "v12-master",
    skillUpdatedBy: actorEmail || "system",
    skillUpdatedAt: new Date(),
    updatedAt: new Date(),
  };
  const updated = await OutboundPilot.findByIdAndUpdate(id, update);
  if (!updated) return NextResponse.json({ error: "pilot not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    sourcePath: r.sourcePath,
    chars: r.content.length,
    lines: r.content.split(/\r?\n/).length,
    skillVersion: "v12-master",
    appliedAt: new Date().toISOString(),
  });
}
