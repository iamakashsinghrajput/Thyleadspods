import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Notification from "@/lib/models/notification";

function buildQuery(role: string, podId: string, email: string) {
  const q: Record<string, unknown> = {};
  if (role === "superadmin" || role === "admin") {
    q.$or = [{ forRole: "admin" }, { forRole: "superadmin" }, { forUserEmail: email.toLowerCase() }];
  } else if (role === "pod") {
    q.$or = [
      { forRole: "pod", forPodId: "" },
      { forRole: "pod", forPodId: podId },
      { forUserEmail: email.toLowerCase() },
    ];
  } else {
    q.forUserEmail = email.toLowerCase();
  }
  return q;
}

export async function GET(req: NextRequest) {
  await connectDB();
  const role = req.nextUrl.searchParams.get("role") || "";
  const podId = req.nextUrl.searchParams.get("podId") || "";
  const email = req.nextUrl.searchParams.get("email") || "";
  const q = buildQuery(role, podId, email);
  const docs = await Notification.find(q).sort({ createdAt: -1 }).limit(200).lean();
  const notifications = docs.map((d) => {
    const n = d as unknown as { _id: { toString(): string }; readBy?: string[]; createdAt: Date; forRole: string; forPodId?: string; forUserEmail?: string; message: string };
    return {
      id: String(n._id),
      forRole: n.forRole,
      forPodId: n.forPodId || undefined,
      forUserEmail: n.forUserEmail || undefined,
      message: n.message,
      read: (n.readBy || []).includes(email.toLowerCase()),
      timestamp: n.createdAt,
    };
  });
  return NextResponse.json({ notifications });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const { forRole, forPodId, forUserEmail, message } = await req.json();
  if (!forRole || !message) {
    return NextResponse.json({ error: "forRole and message required" }, { status: 400 });
  }
  const doc = await Notification.create({
    forRole,
    forPodId: forPodId || "",
    forUserEmail: (forUserEmail || "").toLowerCase(),
    message,
  });
  return NextResponse.json({ id: String(doc._id) });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const { ids, email, all, role, podId } = await req.json();
  const emailLower = (email || "").toLowerCase();
  if (!emailLower) return NextResponse.json({ error: "email required" }, { status: 400 });

  if (all) {
    const q = buildQuery(role || "", podId || "", emailLower);
    await Notification.updateMany(q, { $addToSet: { readBy: emailLower } });
    return NextResponse.json({ ok: true });
  }
  if (Array.isArray(ids) && ids.length) {
    await Notification.updateMany({ _id: { $in: ids } }, { $addToSet: { readBy: emailLower } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "ids[] or all required" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const role = req.nextUrl.searchParams.get("role") || "";
  const podId = req.nextUrl.searchParams.get("podId") || "";
  const email = req.nextUrl.searchParams.get("email") || "";
  const q = buildQuery(role, podId, email);
  await Notification.deleteMany(q);
  return NextResponse.json({ ok: true });
}
