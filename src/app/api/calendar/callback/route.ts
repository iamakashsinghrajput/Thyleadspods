import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { getOAuth2Client } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.redirect(new URL("/attendance?error=missing_params", req.url));
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/attendance?error=no_refresh_token", req.url));
    }

    await connectDB();
    await UserModel.findOneAndUpdate(
      { email: { $regex: new RegExp(`^${userId}@`, "i") } },
      {
        calendarRefreshToken: tokens.refresh_token,
        calendarConnected: true,
      }
    );

    return NextResponse.redirect(new URL("/attendance?connected=true", req.url));
  } catch {
    return NextResponse.redirect(new URL("/attendance?error=auth_failed", req.url));
  }
}
