import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import OtpModel from "@/lib/models/otp";

export async function POST(req: NextRequest) {
  await connectDB();
  const { email, otp, type } = await req.json();

  if (!email || !otp || !type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const record = await OtpModel.findOne({
    email: email.toLowerCase(),
    otp,
    type,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 });
  }

  await OtpModel.deleteMany({ email: email.toLowerCase(), type });

  if (type === "verify" || type === "login") {
    if (type === "verify") {
      await UserModel.findOneAndUpdate(
        { email: email.toLowerCase() },
        { verified: true }
      );
    }
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({
      message: type === "verify" ? "Email verified" : "Login verified",
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        podId: user.podId || undefined,
        projectId: user.projectId || undefined,
        approverId: user.approverId || "",
        avatarUrl: user.avatarUrl || undefined,
      },
    });
  }

  return NextResponse.json({ message: "OTP verified", verified: true });
}
