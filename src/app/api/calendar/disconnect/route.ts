import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  await connectDB();
  await UserModel.findOneAndUpdate(
    { email: { $regex: new RegExp(`^${userId}@`, "i") } },
    { calendarRefreshToken: "", calendarConnected: false }
  );

  return NextResponse.json({ ok: true });
}
