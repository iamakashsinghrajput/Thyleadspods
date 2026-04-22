import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { getSeedUser, reconcileRoleFromSeed } from "@/lib/seed-users";
import { expectedStatusForEmail, notifySuperadminOfPendingUser } from "@/lib/user-approval";

interface GooglePayload {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

async function verifyGoogleToken(credential: string): Promise<GooglePayload> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
  if (!res.ok) throw new Error("Invalid Google token");
  return res.json();
}

export async function POST(req: NextRequest) {
  await connectDB();
  const { credential } = await req.json();

  if (!credential) {
    return NextResponse.json({ error: "Missing credential" }, { status: 400 });
  }

  let payload: GooglePayload;
  try {
    payload = await verifyGoogleToken(credential);
  } catch {
    return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
  }

  if (!payload.email_verified) {
    return NextResponse.json({ error: "Google email not verified" }, { status: 401 });
  }

  const allowed = payload.email.toLowerCase().endsWith("@thyleads.com") || payload.email.toLowerCase() === "akash21052000singh@gmail.com";
  if (!allowed) {
    return NextResponse.json({ error: "Only @thyleads.com accounts are allowed" }, { status: 403 });
  }

  let user = await UserModel.findOne({ email: payload.email.toLowerCase() });

  if (user) {
    if (!user.googleId) user.googleId = payload.sub;
    if (!user.avatarUrl && payload.picture) user.avatarUrl = payload.picture;
    user.verified = true;
    await user.save();
    await reconcileRoleFromSeed(user);
  } else {
    const seed = getSeedUser(payload.email);
    const status = expectedStatusForEmail(payload.email);
    user = await UserModel.create({
      name: payload.name,
      email: payload.email.toLowerCase(),
      googleId: payload.sub,
      avatarUrl: payload.picture || "",
      role: seed?.role ?? "pod",
      podId: seed?.podId ?? "",
      projectId: seed?.projectId ?? "",
      approverId: seed?.approverId ?? "bharath",
      verified: true,
      status,
    });
    if (status === "pending") {
      await notifySuperadminOfPendingUser(payload.name, payload.email);
    }
  }

  if (user.status === "pending") {
    return NextResponse.json({ error: "Your account is awaiting approval from the superadmin." }, { status: 403 });
  }
  if (user.status === "rejected") {
    return NextResponse.json({ error: "Your account has been rejected." }, { status: 403 });
  }

  return NextResponse.json({
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
