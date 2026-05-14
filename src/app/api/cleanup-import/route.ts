import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import ClientDetail from "@/lib/models/client-detail";
import Project from "@/lib/models/project";
import UserModel from "@/lib/models/user";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";

async function actorRole(email: string): Promise<string> {
  if ((email || "").toLowerCase() === SUPERADMIN_EMAIL) return "superadmin";
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

// One-shot cleanup for the XLSX import side-effects. Two phases:
//
//   Phase A — Imported meetings:
//     Every meeting created by /api/meetings/import has its `id` prefixed
//     with "imp_" (see detailIdFor in that route). We delete those.
//
//   Phase B — Auto-created projects:
//     Same import created Project docs with assignedPod === "Unassigned"
//     for client names that didn't already exist in the DB. Once their
//     imported details are gone, any project that's still on
//     "Unassigned" AND has no remaining details is an orphan from the
//     import — those get deleted too.
//
// Pre-existing data (static seeds, pod-added meetings, real projects)
// is left strictly untouched.
export async function POST(req: NextRequest) {
  const actor = req.nextUrl.searchParams.get("actor") || "";
  const role = await actorRole(actor);
  if (role !== "superadmin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const commit = req.nextUrl.searchParams.get("commit") === "1";

  await connectDB();

  // Phase A — count imported details.
  const importedCount = await ClientDetail.countDocuments({ id: { $regex: /^imp_/ } });

  // Phase B — find auto-created Projects (assignedPod === "Unassigned") and,
  // for each, count how many NON-imported details still reference them.
  const unassignedProjects = await Project.find({ assignedPod: "Unassigned" })
    .select("id clientName createdAt")
    .lean<{ id: string; clientName: string; createdAt?: Date }[]>();

  const orphanProjects: { id: string; clientName: string; createdAt?: Date }[] = [];
  for (const p of unassignedProjects) {
    const nonImportedRemaining = await ClientDetail.countDocuments({
      projectId: p.id,
      id: { $not: /^imp_/ },
    });
    if (nonImportedRemaining === 0) orphanProjects.push(p);
  }

  if (!commit) {
    return NextResponse.json({
      dryRun: true,
      importedDetailsToDelete: importedCount,
      unassignedProjectsTotal: unassignedProjects.length,
      orphanProjectsToDelete: orphanProjects.length,
      orphanProjectSample: orphanProjects.slice(0, 20).map((p) => ({ id: p.id, clientName: p.clientName })),
      hint: "Re-run with &commit=1 to perform the deletion.",
    });
  }

  // Execute. Phase A first so Phase B's empty check stays accurate.
  const delDetails = await ClientDetail.deleteMany({ id: { $regex: /^imp_/ } });

  const orphanIds = orphanProjects.map((p) => p.id);
  const delProjects = orphanIds.length > 0
    ? await Project.deleteMany({ id: { $in: orphanIds } })
    : { deletedCount: 0 };

  return NextResponse.json({
    ok: true,
    deletedImportedDetails: delDetails.deletedCount,
    deletedOrphanProjects: delProjects.deletedCount,
  });
}

export async function GET() {
  return NextResponse.json({
    hint: "POST with ?actor=...&commit=0 to preview, &commit=1 to delete imported meetings + orphan projects.",
  });
}
