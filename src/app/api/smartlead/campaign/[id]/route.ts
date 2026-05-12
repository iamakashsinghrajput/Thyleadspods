import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import {
  fetchCampaign,
  fetchCampaignAnalytics,
  fetchCampaignSequences,
  fetchCampaignEmailAccounts,
  fetchCampaignSchedule,
} from "@/lib/smartlead";

async function actorRole(email: string): Promise<string> {
  if ((email || "").toLowerCase() === SUPERADMIN_EMAIL) return "superadmin";
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = req.nextUrl.searchParams.get("actor") || "";
  await connectDB();
  const role = await actorRole(actor);
  if (!["superadmin", "admin", "pod"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.SMARTLEAD_API_KEY) {
    return NextResponse.json({ error: "SMARTLEAD_API_KEY missing on server" }, { status: 503 });
  }

  try {
    const [meta, analytics, sequences, accounts, schedule] = await Promise.all([
      fetchCampaign(id).catch(() => null),
      fetchCampaignAnalytics(id).catch(() => null),
      fetchCampaignSequences(id).catch(() => []),
      fetchCampaignEmailAccounts(id).catch(() => []),
      fetchCampaignSchedule(id).catch(() => null),
    ]);
    if (!meta) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json({ campaign: meta, analytics, sequences, accounts, schedule });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Smartlead error" }, { status: 502 });
  }
}
