import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import Project from "@/lib/models/project";
import AccountsSheet from "@/lib/models/accounts-sheet";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import { migrateLegacyGlobalSheet } from "@/lib/accounts-migrate";

async function actorRole(email: string): Promise<string> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  if (e === SUPERADMIN_EMAIL) return "superadmin";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

type ProjectRow = {
  id: string;
  clientId?: string;
  clientName?: string;
  websiteUrl?: string;
  logoUrl?: string;
};

type SheetRow = {
  projectId: string;
  totals?: { uploaded?: number; uniqueDomains?: number };
  manualDnc?: string[];
  updatedAt?: Date | null;
  originalFileName?: string;
};

export async function GET(req: NextRequest) {
  const actor = req.nextUrl.searchParams.get("actor") || "";
  const role = await actorRole(actor);
  if (role !== "superadmin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  await migrateLegacyGlobalSheet();

  const [projects, sheets] = await Promise.all([
    Project.find({}).select("id clientId clientName websiteUrl logoUrl").lean<ProjectRow[]>(),
    AccountsSheet.find({}).select("projectId totals manualDnc updatedAt originalFileName").lean<SheetRow[]>(),
  ]);

  const sheetByProject = new Map(sheets.map((s) => [s.projectId, s]));

  const cards = projects
    .map((p) => {
      const s = sheetByProject.get(p.id);
      const uploaded = s?.totals?.uploaded ?? 0;
      const uniqueDomains = s?.totals?.uniqueDomains ?? 0;
      const dncCount = (s?.manualDnc || []).length;
      return {
        projectId: p.id,
        clientId: p.clientId || "",
        clientName: p.clientName || "",
        websiteUrl: p.websiteUrl || "",
        logoUrl: p.logoUrl || "",
        uploaded,
        uniqueDomains,
        dncCount,
        hasSheet: !!s,
        originalFileName: s?.originalFileName || "",
        updatedAt: s?.updatedAt ? new Date(s.updatedAt).toISOString() : null,
      };
    })
    .sort((a, b) => a.clientName.localeCompare(b.clientName));

  return NextResponse.json({ cards });
}
