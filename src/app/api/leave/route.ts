import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import LeaveRequest from "@/lib/models/leave-request";
import Attendance from "@/lib/models/attendance";

export async function GET(req: NextRequest) {
  await connectDB();
  const userId = req.nextUrl.searchParams.get("userId");
  const all = req.nextUrl.searchParams.get("all");
  const status = req.nextUrl.searchParams.get("status");

  if (all === "true") {
    const approverId = req.nextUrl.searchParams.get("approverId");
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (approverId) query.approverId = approverId;
    const records = await LeaveRequest.find(query).sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json({ records });
  }

  if (userId) {
    const records = await LeaveRequest.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json({ records });
  }

  return NextResponse.json({ records: [] });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const { action } = body;

  if (action === "apply") {
    const { userId, userName, leaveDate, leaveType, subject, body: appBody, approverId } = body;

    const existing = await LeaveRequest.findOne({ userId, leaveDate, status: { $in: ["pending", "approved"] } });
    if (existing) {
      return NextResponse.json({ error: "You already have a leave request for this date" }, { status: 400 });
    }

    const record = await LeaveRequest.create({
      userId,
      userName,
      leaveDate,
      leaveType,
      subject,
      body: appBody,
      approverId: approverId || "",
    });
    return NextResponse.json({ record });
  }

  if (action === "approve") {
    const { requestId, adminNote } = body;
    const request = await LeaveRequest.findByIdAndUpdate(
      requestId,
      { status: "approved", adminNote: adminNote || "" },
      { new: true }
    );
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    await Attendance.findOneAndUpdate(
      { userId: request.userId, date: request.leaveDate },
      {
        userId: request.userId,
        userName: request.userName,
        date: request.leaveDate,
        status: "leave",
        isLeave: true,
        punchIn: null,
        punchOut: null,
        totalMinutes: 0,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ record: request });
  }

  if (action === "deny") {
    const { requestId, adminNote } = body;
    const request = await LeaveRequest.findByIdAndUpdate(
      requestId,
      { status: "denied", adminNote: adminNote || "" },
      { new: true }
    );
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    return NextResponse.json({ record: request });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
