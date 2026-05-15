import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import Project from "@/lib/models/project";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import { isApiKeyConfigured, parseSpreadsheetId } from "@/lib/google-sheets";
import { migrateLegacyGlobalSheet } from "@/lib/accounts-migrate";
import { syncFromGoogleSheet } from "@/lib/accounts-sync";

export const maxDuration = 120;

async function actorRole(email: string): Promise<string> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  if (e === SUPERADMIN_EMAIL) return "superadmin";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

export async function POST(req: NextRequest) {
  let body: { actor?: string; projectId?: string; sheetUrl?: string; spreadsheetId?: string; tabTitle?: string; tabSheetId?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const actor = String(body.actor || "");
  const role = await actorRole(actor);
  if (role !== "superadmin" && role !== "admin" && role !== "pod") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isApiKeyConfigured()) {
    return NextResponse.json({ error: "GOOGLE_API_KEY is not configured on the server" }, { status: 503 });
  }

  const projectId = String(body.projectId || "").trim();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  const tabTitle = String(body.tabTitle || "").trim();
  if (!tabTitle) return NextResponse.json({ error: "tabTitle required" }, { status: 400 });

  const spreadsheetId = (String(body.spreadsheetId || "").trim()) || parseSpreadsheetId(String(body.sheetUrl || ""));
  if (!spreadsheetId) return NextResponse.json({ error: "spreadsheetId or sheetUrl required" }, { status: 400 });

  await connectDB();
  const project = await Project.findOne({ id: projectId }).select("id").lean<{ id: string }>();
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  await migrateLegacyGlobalSheet();

  try {
    const result = await syncFromGoogleSheet({
      projectId,
      spreadsheetId,
      tabTitle,
      tabSheetId: typeof body.tabSheetId === "number" ? body.tabSheetId : null,
      sheetUrl: String(body.sheetUrl || ""),
      actor,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    const stack = e instanceof Error ? e.stack : "";
    const detectedHeaders = (e as { detectedHeaders?: string[] })?.detectedHeaders;
    console.error("[accounts/save-tab] sync failed:", msg, stack);
    return NextResponse.json({ error: msg, detectedHeaders }, { status: 400 });
  }
}
