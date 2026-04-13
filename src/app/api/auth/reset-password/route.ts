import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  await connectDB();
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  user.password = await bcrypt.hash(password, 10);
  await user.save();

  return NextResponse.json({ message: "Password reset successfully" });
}
