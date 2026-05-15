import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import Project from "@/lib/models/project";
import AccountsSheet from "@/lib/models/accounts-sheet";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import { normalizeDomain } from "@/lib/accounts-domain";
import { migrateLegacyGlobalSheet } from "@/lib/accounts-migrate";

async function actorRole(email: string): Promise<string> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  if (e === SUPERADMIN_EMAIL) return "superadmin";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

function parseRawList(raw: string): string[] {
  const tokens = raw
    .split(/[\s,;\n\r\t]+/g)
    .map((t) => normalizeDomain(t))
    .filter((t) => t.length > 0);
  return Array.from(new Set(tokens)).sort();
}

export async function POST(req: NextRequest) {
  let body: { actor?: string; projectId?: string; raw?: string; entries?: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const actor = String(body.actor || "");
  const role = await actorRole(actor);
  if (role !== "superadmin" && role !== "admin" && role !== "pod") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = String(body.projectId || "").trim();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  await connectDB();
  const project = await Project.findOne({ id: projectId }).select("id").lean<{ id: string }>();
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  await migrateLegacyGlobalSheet();

  const source = typeof body.raw === "string"
    ? body.raw
    : Array.isArray(body.entries)
      ? body.entries.join("\n")
      : "";
  const manualDnc = parseRawList(source);

  await AccountsSheet.updateOne(
    { projectId },
    {
      $set: {
        manualDnc,
        manualDncUpdatedAt: new Date(),
        manualDncUpdatedBy: actor.toLowerCase(),
      },
      $setOnInsert: { projectId, rows: [] },
    },
    { upsert: true },
  );

  return NextResponse.json({ ok: true, count: manualDnc.length, manualDnc });
}
