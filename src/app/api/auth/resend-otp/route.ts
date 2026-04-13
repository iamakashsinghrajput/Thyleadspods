import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OtpModel from "@/lib/models/otp";
import { sendOtpEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  await connectDB();
  const { email, type } = await req.json();

  if (!email || !type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await OtpModel.deleteMany({ email: email.toLowerCase(), type });
  await OtpModel.create({
    email: email.toLowerCase(),
    otp,
    type,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  try {
    await sendOtpEmail(email.toLowerCase(), otp, type);
  } catch {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ message: "OTP resent" });
}
