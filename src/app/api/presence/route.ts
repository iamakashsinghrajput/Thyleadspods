import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Presence from "@/lib/models/presence";

const ONLINE_THRESHOLD_MS = 30000;

export async function GET() {
  await connectDB();
  const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);
  const online = await Presence.find({ lastSeen: { $gte: cutoff } }).lean();
  const onlineIds = online.map((p) => (p as unknown as { userId: string }).userId);
  return NextResponse.json({ online: onlineIds });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const { userId, userName } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await Presence.findOneAndUpdate(
    { userId },
    { userId, userName, lastSeen: new Date() },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
