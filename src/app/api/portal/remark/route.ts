import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Remark from "@/lib/models/remark";

export async function POST(req: NextRequest) {
  await connectDB();
  const { projectId, meetingId, remark, updatedBy } = await req.json();

  if (!projectId || !meetingId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const record = await Remark.findOneAndUpdate(
    { projectId, meetingId },
    { remark: remark || "", updatedAt: new Date(), updatedBy: updatedBy || "" },
    { upsert: true, new: true }
  );

  return NextResponse.json({
    remark: record.remark,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
  });
}
