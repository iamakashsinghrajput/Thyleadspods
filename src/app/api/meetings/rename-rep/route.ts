import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import ClientDetail from "@/lib/models/client-detail";
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

// Bulk-rename a person across ClientDetail rows. By default looks at salesRep,
// but can also touch accountManager via &field=accountManager. Match is exact
// (case-insensitive). Dry-run unless &commit=1.
//
//   POST /api/meetings/rename-rep
//     ?actor=...
//     &from=Manshi
//     &to=Manshi%20Kaverappa
//     &commit=0
export async function POST(req: NextRequest) {
  const actor = req.nextUrl.searchParams.get("actor") || "";
  const role = await actorRole(actor);
  if (role !== "superadmin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fromName = (req.nextUrl.searchParams.get("from") || "").trim();
  const toName = (req.nextUrl.searchParams.get("to") || "").trim();
  const field = (req.nextUrl.searchParams.get("field") || "salesRep").trim();
  const commit = req.nextUrl.searchParams.get("commit") === "1";

  if (!fromName || !toName) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }
  if (fromName.toLowerCase() === toName.toLowerCase()) {
    return NextResponse.json({ error: "from and to are the same name" }, { status: 400 });
  }
  if (!["salesRep", "accountManager"].includes(field)) {
    return NextResponse.json({ error: "field must be salesRep or accountManager" }, { status: 400 });
  }

  await connectDB();

  // Exact match, case-insensitive — anchored so "Manshi" matches "Manshi" and
  // "manshi  " (with trailing space) but NOT "Manshi Kaverappa".
  const matchRegex = new RegExp(`^\\s*${fromName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");

  const filter = { [field]: { $regex: matchRegex } } as Record<string, unknown>;
  const matchedCount = await ClientDetail.countDocuments(filter);

  // Always include a small sample so the user can spot-check.
  const sample = await ClientDetail.find(filter)
    .select(`projectId id ${field} clientName meetingDate`)
    .limit(10)
    .lean();

  if (!commit) {
    return NextResponse.json({
      dryRun: true,
      field,
      from: fromName,
      to: toName,
      wouldUpdate: matchedCount,
      sample,
      hint: "Re-run with &commit=1 to apply.",
    });
  }

  const result = await ClientDetail.updateMany(filter, { $set: { [field]: toName } });
  return NextResponse.json({
    ok: true,
    field,
    from: fromName,
    to: toName,
    updated: result.modifiedCount,
    matched: matchedCount,
  });
}

export async function GET() {
  return NextResponse.json({
    hint: "POST with ?actor=...&from=Manshi&to=Manshi%20Kaverappa&commit=0 to preview, &commit=1 to apply.",
  });
}
