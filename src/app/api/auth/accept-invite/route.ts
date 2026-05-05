import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";

interface InviteUserDoc {
  _id: { toString(): string };
  name: string;
  email: string;
  role: string;
  podId?: string;
  projectId?: string;
  approverId?: string;
  avatarUrl?: string;
  inviteToken?: string;
  inviteTokenExpiresAt?: Date;
  verified?: boolean;
  status?: string;
}

export async function GET(req: NextRequest) {
  await connectDB();
  const token = (req.nextUrl.searchParams.get("token") || "").trim();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const user = await UserModel.findOne({ inviteToken: token }).lean<InviteUserDoc>();
  if (!user) return NextResponse.json({ error: "Invite not found or already used" }, { status: 404 });
  if (user.inviteTokenExpiresAt && user.inviteTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "Invite has expired. Ask the admin to send a new one." }, { status: 410 });
  }

  return NextResponse.json({
    invite: {
      name: user.name,
      email: user.email,
      role: user.role,
      verified: !!user.verified,
      expiresAt: user.inviteTokenExpiresAt || null,
    },
  });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const token = String(body.token || "").trim();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();

  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const user = await UserModel.findOne({ inviteToken: token }) as unknown as (InviteUserDoc & { save(): Promise<unknown>; password?: string }) | null;
  if (!user) return NextResponse.json({ error: "Invite not found or already used" }, { status: 404 });
  if (user.inviteTokenExpiresAt && user.inviteTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "Invite has expired. Ask the admin to send a new one." }, { status: 410 });
  }

  user.password = await bcrypt.hash(password, 10);
  if (name) user.name = name;
  user.verified = true;
  user.status = "approved";
  user.inviteToken = "";
  user.inviteTokenExpiresAt = undefined;
  await user.save();

  return NextResponse.json({
    ok: true,
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
