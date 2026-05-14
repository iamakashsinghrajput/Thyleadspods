import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import InboxThread from "@/lib/models/inbox-thread";
import { syncThreadMessages } from "@/lib/inbox-sync";

export async function POST(req: NextRequest) {
  await connectDB();

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 100), 500);

  const broken = await InboxThread.find({
    $or: [
      { leadFirstName: { $in: [null, ""] }, leadLastName: { $in: [null, ""] } },
      { campaignName: { $in: [null, ""] } },
    ],
  })
    .sort({ lastReplyAt: -1 })
    .limit(limit)
    .select("leadId campaignId threadKey leadFirstName leadLastName campaignName")
    .lean<{ leadId: number; campaignId: number; threadKey: string }[]>();

  const results = await Promise.all(
    broken.map(async (t) => {
      const r = await syncThreadMessages(t.leadId, t.campaignId, { force: true });
      return { threadKey: t.threadKey, messages: r.messages, error: r.error };
    }),
  );

  return NextResponse.json({
    ok: true,
    scanned: broken.length,
    results,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST /api/inbox/repair?limit=100 to re-enrich threads with missing lead/campaign names",
  });
}
