import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";

function isSuperadmin(email: string): boolean {
  return (email || "").toLowerCase() === SUPERADMIN_EMAIL;
}

export async function GET(req: NextRequest) {
  await connectDB();
  const actor = req.nextUrl.searchParams.get("actor") || "";
  if (!isSuperadmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const docs = await UserModel.find({}).sort({ createdAt: -1 }).lean();
  const users = docs.map((u) => {
    const x = u as unknown as {
      _id: { toString(): string };
      name: string;
      email: string;
      role: string;
      podId?: string;
      status?: string;
      verified?: boolean;
      createdAt: Date;
    };
    return {
      id: String(x._id),
      name: x.name,
      email: x.email,
      role: x.role,
      podId: x.podId || "",
      status: x.status || "approved",
      verified: !!x.verified,
      createdAt: x.createdAt,
    };
  });
  return NextResponse.json({ users });
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const actor = req.nextUrl.searchParams.get("actor") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!isSuperadmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const target = await UserModel.findById(id).lean<{ email?: string }>();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if ((target.email || "").toLowerCase() === SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: "Cannot delete the superadmin account" }, { status: 400 });
  }
  await UserModel.findByIdAndDelete(id);
  return NextResponse.json({ ok: true, deletedEmail: target.email || "" });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actor = String(body.actor || "");
  const id = String(body.id || "");
  if (!isSuperadmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.podId === "string") update.podId = body.podId;
  if (typeof body.role === "string" && ["superadmin", "admin", "pod", "client"].includes(body.role)) update.role = body.role;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "no fields to update" }, { status: 400 });

  const updated = await UserModel.findByIdAndUpdate(id, update, { new: true }).lean<{ email?: string; podId?: string; role?: string }>();
  if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ ok: true, user: { id, email: updated.email || "", podId: updated.podId || "", role: updated.role || "" } });
}
