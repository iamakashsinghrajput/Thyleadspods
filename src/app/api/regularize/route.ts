import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Regularize from "@/lib/models/regularize";
import Attendance from "@/lib/models/attendance";

export async function GET(req: NextRequest) {
  await connectDB();
  const userId = req.nextUrl.searchParams.get("userId");
  const all = req.nextUrl.searchParams.get("all");

  if (all === "true") {
    const status = req.nextUrl.searchParams.get("status") || "pending";
    const approverId = req.nextUrl.searchParams.get("approverId");
    const query: Record<string, unknown> = { status };
    if (approverId) query.approverId = approverId;
    const records = await Regularize.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ records: records.map((r) => ({ ...r, _id: String(r._id) })) });
  }

  if (userId) {
    const records = await Regularize.find({ userId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ records: records.map((r) => ({ ...r, _id: String(r._id) })) });
  }

  return NextResponse.json({ records: [] });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const { action } = body;

  if (action === "request") {
    const { userId, userName, date, punchIn, punchOut, reason } = body;
    if (!userId || !userName || !date || !punchIn || !punchOut || !reason) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const existing = await Regularize.findOne({ userId, date, status: "pending" });
    if (existing) {
      return NextResponse.json({ error: "Request already pending for this date" }, { status: 400 });
    }
    const { approverId } = body;
    const record = await Regularize.create({ userId, userName, date, punchIn, punchOut, reason, approverId: approverId || "" });
    return NextResponse.json({ record: { ...record.toObject(), _id: String(record._id) } }, { status: 201 });
  }

  if (action === "approve" || action === "reject") {
    const { requestId, adminNote } = body;
    if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 });

    const record = await Regularize.findById(requestId);
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    record.status = action === "approve" ? "approved" : "rejected";
    record.adminNote = adminNote || "";
    await record.save();

    if (action === "approve") {
      const inH = parseInt(record.punchIn.split(":")[0]);
      const inM = parseInt(record.punchIn.split(":")[1]);
      const outH = parseInt(record.punchOut.split(":")[0]);
      const outM = parseInt(record.punchOut.split(":")[1]);
      const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
      const status = totalMinutes >= 240 ? "present" : "half-day";

      await Attendance.findOneAndUpdate(
        { userId: record.userId, date: record.date },
        {
          userId: record.userId,
          userName: record.userName,
          date: record.date,
          punchIn: record.punchIn,
          punchOut: record.punchOut,
          totalMinutes: Math.max(0, totalMinutes),
          status,
        },
        { upsert: true, new: true }
      );
    }

    return NextResponse.json({ record: { ...record.toObject(), _id: String(record._id) } });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
