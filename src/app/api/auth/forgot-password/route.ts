import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import OtpModel from "@/lib/models/otp";
import { sendOtpEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  await connectDB();
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const allowed = email.toLowerCase().endsWith("@thyleads.com") || email.toLowerCase() === "akash21052000singh@gmail.com";
  if (!allowed) {
    return NextResponse.json({ error: "Only @thyleads.com accounts are allowed" }, { status: 403 });
  }

  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) {
    return NextResponse.json({ message: "If that email exists, an OTP has been sent" });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await OtpModel.deleteMany({ email: email.toLowerCase(), type: "reset" });
  await OtpModel.create({
    email: email.toLowerCase(),
    otp,
    type: "reset",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  try {
    await sendOtpEmail(email.toLowerCase(), otp, "reset");
  } catch {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ message: "If that email exists, an OTP has been sent" });
}
