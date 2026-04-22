import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import Notification from "@/lib/models/notification";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";

function assertSuperadmin(email: string): boolean {
  return email.toLowerCase() === SUPERADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  await connectDB();
  const requester = req.nextUrl.searchParams.get("requester") || "";
  if (!assertSuperadmin(requester)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await UserModel.find({ status: "pending" }).sort({ createdAt: -1 }).lean();
  const pending = users.map((u) => {
    const x = u as unknown as { _id: { toString(): string }; name: string; email: string; createdAt: Date };
    return { id: String(x._id), name: x.name, email: x.email, createdAt: x.createdAt };
  });
  return NextResponse.json({ pending });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const { requester, email, action } = await req.json();
  if (!assertSuperadmin(requester || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!email || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "email and action required" }, { status: 400 });
  }
  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  user.status = action === "approve" ? "approved" : "rejected";
  await user.save();

  await Notification.create({
    forRole: "pod",
    forUserEmail: user.email,
    message: action === "approve"
      ? "Your account has been approved. You can now log in."
      : "Your account request was rejected.",
  });

  return NextResponse.json({ ok: true, status: user.status });
}
