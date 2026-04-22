import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import OtpModel from "@/lib/models/otp";
import bcrypt from "bcryptjs";
import { sendOtpEmail } from "@/lib/mailer";
import { expectedStatusForEmail, notifySuperadminOfPendingUser } from "@/lib/user-approval";

export async function POST(req: NextRequest) {
  await connectDB();
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const allowed = email.toLowerCase().endsWith("@thyleads.com") || email.toLowerCase() === "akash21052000singh@gmail.com";
  if (!allowed) {
    return NextResponse.json({ error: "Only @thyleads.com email addresses are allowed" }, { status: 403 });
  }

  const existing = await UserModel.findOne({ email: email.toLowerCase() });
  if (existing && existing.verified) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);

  const status = expectedStatusForEmail(email);

  if (existing && !existing.verified) {
    existing.name = name;
    existing.password = hashed;
    await existing.save();
  } else {
    await UserModel.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: "pod",
      approverId: "bharath",
      verified: false,
      status,
    });
    if (status === "pending") {
      await notifySuperadminOfPendingUser(name, email);
    }
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await OtpModel.deleteMany({ email: email.toLowerCase(), type: "verify" });
  await OtpModel.create({
    email: email.toLowerCase(),
    otp,
    type: "verify",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  try {
    await sendOtpEmail(email.toLowerCase(), otp, "verify");
  } catch {
    return NextResponse.json({ error: "Failed to send verification email. Check SMTP settings." }, { status: 500 });
  }

  return NextResponse.json({ message: "OTP sent to your email" });
}
