import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") || "").toLowerCase().trim();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  await connectDB();
  const doc = await UserModel.findOne({ email }).lean<{
    name?: string;
    email?: string;
    role?: string;
    podId?: string;
    projectId?: string;
    approverId?: string;
    avatarUrl?: string;
    status?: string;
  }>();

  if (!doc) return NextResponse.json({ error: "not-found" }, { status: 404 });

  return NextResponse.json({
    user: {
      name: doc.name || "",
      email: doc.email || "",
      role: doc.role || "pod",
      podId: doc.podId || "",
      projectId: doc.projectId || "",
      avatarUrl: doc.avatarUrl || "",
      approverId: doc.approverId || "",
      status: doc.status || "approved",
    },
  });
}
