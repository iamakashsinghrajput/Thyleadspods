import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import Project from "@/lib/models/project";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import { parseSpreadsheetId, listTabs, isApiKeyConfigured } from "@/lib/google-sheets";

async function actorRole(email: string): Promise<string> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  if (e === SUPERADMIN_EMAIL) return "superadmin";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

export async function POST(req: NextRequest) {
  let body: { actor?: string; projectId?: string; sheetUrl?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const actor = String(body.actor || "");
  const role = await actorRole(actor);
  if (role !== "superadmin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = String(body.projectId || "").trim();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  await connectDB();
  const project = await Project.findOne({ id: projectId }).select("id").lean<{ id: string }>();
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  if (!isApiKeyConfigured()) {
    return NextResponse.json({ error: "GOOGLE_API_KEY is not configured on the server" }, { status: 503 });
  }

  const sheetUrl = String(body.sheetUrl || "").trim();
  const spreadsheetId = parseSpreadsheetId(sheetUrl);
  if (!spreadsheetId) {
    return NextResponse.json({ error: "Could not parse a Google Sheets URL" }, { status: 400 });
  }

  try {
    const tabs = await listTabs(spreadsheetId);
    return NextResponse.json({ ok: true, spreadsheetId, tabs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to read sheet";
    return NextResponse.json({ error: msg, hint: "Make sure the sheet is shared as 'Anyone with the link can view'." }, { status: 502 });
  }
}
