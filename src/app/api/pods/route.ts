import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import Pod from "@/lib/models/pod";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";

const POD_COLORS = [
  { color: "bg-emerald-500", text: "text-emerald-700", bgLight: "bg-emerald-50" },
  { color: "bg-purple-500",  text: "text-purple-700",  bgLight: "bg-purple-50" },
  { color: "bg-orange-500",  text: "text-orange-700",  bgLight: "bg-orange-50" },
  { color: "bg-sky-500",     text: "text-sky-700",     bgLight: "bg-sky-50" },
  { color: "bg-rose-500",    text: "text-rose-700",    bgLight: "bg-rose-50" },
  { color: "bg-teal-500",    text: "text-teal-700",    bgLight: "bg-teal-50" },
  { color: "bg-amber-500",   text: "text-amber-700",   bgLight: "bg-amber-50" },
  { color: "bg-indigo-500",  text: "text-indigo-700",  bgLight: "bg-indigo-50" },
  { color: "bg-cyan-500",    text: "text-cyan-700",    bgLight: "bg-cyan-50" },
  { color: "bg-pink-500",    text: "text-pink-700",    bgLight: "bg-pink-50" },
];

const DEFAULT_PODS = [
  { id: "pod1", name: "Pod 1", members: ["Kunal", "Shruti"], order: 0 },
  { id: "pod2", name: "Pod 2", members: ["Manshi", "Naman"], order: 1 },
  { id: "pod3", name: "Pod 3", members: ["Krishna", "Mridul"], order: 2 },
  { id: "pod4", name: "Pod 4", members: ["Sandeep", "Pranesh"], order: 3 },
];

async function ensureSeeded() {
  const count = await Pod.estimatedDocumentCount();
  if (count > 0) return;
  await Pod.insertMany(DEFAULT_PODS.map((p, idx) => ({
    ...p,
    ...POD_COLORS[idx % POD_COLORS.length],
  })));
}

async function actorRole(email: string): Promise<string> {
  if ((email || "").toLowerCase() === SUPERADMIN_EMAIL) return "superadmin";
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

export async function GET() {
  await connectDB();
  await ensureSeeded();
  const docs = await Pod.find({}).sort({ order: 1, createdAt: 1 }).lean<Array<{
    id: string; name: string; members: string[]; color: string; text: string; bgLight: string; order?: number;
  }>>();
  const pods = docs.map((d) => ({
    id: d.id,
    name: d.name,
    members: d.members || [],
    color: d.color || "bg-slate-500",
    text: d.text || "text-slate-700",
    bgLight: d.bgLight || "bg-slate-50",
  }));
  return NextResponse.json({ pods });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actor = String(body.actor || "");
  const role = await actorRole(actor);
  if (!["superadmin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const members: string[] = Array.isArray(body.members) ? body.members.map(String) : [];

  const existing = await Pod.find({}).select("id order").lean<Array<{ id: string; order?: number }>>();
  let n = existing.length + 1;
  while (existing.some((p) => p.id === `pod${n}`)) n++;
  const nextOrder = (existing.reduce((m, p) => Math.max(m, p.order ?? 0), -1)) + 1;
  const colorSet = POD_COLORS[existing.length % POD_COLORS.length];

  const created = await Pod.create({
    id: `pod${n}`,
    name,
    members,
    order: nextOrder,
    ...colorSet,
  });

  return NextResponse.json({
    pod: {
      id: created.id, name: created.name, members: created.members,
      color: created.color, text: created.text, bgLight: created.bgLight,
    },
  });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actor = String(body.actor || "");
  const role = await actorRole(actor);
  if (!["superadmin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (Array.isArray(body.members)) update.members = body.members.map(String);
  if (typeof body.name === "string") update.name = body.name;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "no fields to update" }, { status: 400 });

  const updated = await Pod.findOneAndUpdate({ id }, { $set: update }, { new: true }).lean<{
    id: string; name: string; members: string[]; color: string; text: string; bgLight: string;
  }>();
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    pod: {
      id: updated.id, name: updated.name, members: updated.members,
      color: updated.color, text: updated.text, bgLight: updated.bgLight,
    },
  });
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const actor = req.nextUrl.searchParams.get("actor") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  const role = await actorRole(actor);
  if (!["superadmin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await Pod.deleteOne({ id });
  return NextResponse.json({ ok: true });
}
