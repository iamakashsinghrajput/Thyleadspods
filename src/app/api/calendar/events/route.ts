import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { getCalendarEvents } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const timeMin = req.nextUrl.searchParams.get("timeMin") || undefined;
  const timeMax = req.nextUrl.searchParams.get("timeMax") || undefined;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  await connectDB();
  const user = await UserModel.findOne({
    email: { $regex: new RegExp(`^${userId}@`, "i") },
  });

  if (!user || !user.calendarRefreshToken) {
    return NextResponse.json({ error: "Calendar not connected", connected: false }, { status: 400 });
  }

  try {
    const events = await getCalendarEvents(user.calendarRefreshToken, timeMin, timeMax);
    return NextResponse.json({ events, connected: true });
  } catch {
    return NextResponse.json({ error: "Failed to fetch events. Try reconnecting.", connected: false }, { status: 500 });
  }
}
