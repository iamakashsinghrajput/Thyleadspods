import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Remark from "@/lib/models/remark";

export async function GET(req: NextRequest) {
  await connectDB();
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const remarks = await Remark.find({ projectId }).lean();
  const remarkMap: Record<string, { remark: string; updatedAt: string; updatedBy: string }> = {};
  for (const r of remarks) {
    const rm = r as unknown as { meetingId: string; remark: string; updatedAt: Date; updatedBy: string };
    remarkMap[rm.meetingId] = {
      remark: rm.remark,
      updatedAt: rm.updatedAt.toISOString(),
      updatedBy: rm.updatedBy,
    };
  }

  return NextResponse.json({ remarks: remarkMap });
}
