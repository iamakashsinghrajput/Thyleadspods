import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import OtpModel from "@/lib/models/otp";
import bcrypt from "bcryptjs";
import { sendOtpEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  await connectDB();
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const allowed = email.toLowerCase().endsWith("@thyleads.com") || email.toLowerCase() === "akash21052000singh@gmail.com";
  if (!allowed) {
    return NextResponse.json({ error: "Only @thyleads.com accounts are allowed" }, { status: 403 });
  }

  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (!user.verified) {
    return NextResponse.json({ error: "Please verify your email first", needsVerification: true }, { status: 403 });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await OtpModel.deleteMany({ email: email.toLowerCase(), type: "login" });
  await OtpModel.create({
    email: email.toLowerCase(),
    otp,
    type: "login",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  try {
    await sendOtpEmail(email.toLowerCase(), otp, "verify");
  } catch {
    return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
  }

  return NextResponse.json({ needsLoginOtp: true, message: "OTP sent to your email" });
}
