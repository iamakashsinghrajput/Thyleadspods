import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Signature from "@/lib/models/signature";

interface SignatureDoc {
  _id: { toString(): string };
  name: string;
  personName: string;
  position?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  linkedInUrl?: string;
  websiteUrl?: string;
  createdBy: string;
  sharedWithRoles?: string[];
  sharedWithPodIds?: string[];
  sharedWithEmails?: string[];
  createdAt: Date;
  updatedAt: Date;
}

function serialize(d: SignatureDoc) {
  return {
    id: String(d._id),
    name: d.name,
    personName: d.personName,
    position: d.position || "",
    phone: d.phone || "",
    addressLine1: d.addressLine1 || "",
    addressLine2: d.addressLine2 || "",
    linkedInUrl: d.linkedInUrl || "",
    websiteUrl: d.websiteUrl || "",
    createdBy: d.createdBy,
    sharedWithRoles: d.sharedWithRoles || [],
    sharedWithPodIds: d.sharedWithPodIds || [],
    sharedWithEmails: d.sharedWithEmails || [],
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function normEmail(v: string) {
  return (v || "").trim().toLowerCase();
}

const STRUCTURED_FIELDS = [
  "name",
  "personName",
  "position",
  "phone",
  "addressLine1",
  "addressLine2",
  "linkedInUrl",
  "websiteUrl",
] as const;

export async function GET(req: NextRequest) {
  await connectDB();
  const role = (req.nextUrl.searchParams.get("role") || "").toLowerCase();
  const email = normEmail(req.nextUrl.searchParams.get("email") || "");
  const podId = req.nextUrl.searchParams.get("podId") || "";

  if (role === "superadmin") {
    const docs = (await Signature.find({}).sort({ updatedAt: -1 }).lean()) as unknown as SignatureDoc[];
    return NextResponse.json({ signatures: docs.map(serialize) });
  }

  if (!role || !email) return NextResponse.json({ signatures: [] });

  const q: Record<string, unknown> = {
    $or: [
      { sharedWithRoles: role },
      { sharedWithEmails: email },
      ...(podId ? [{ sharedWithPodIds: podId }] : []),
    ],
  };
  const docs = (await Signature.find(q).sort({ updatedAt: -1 }).lean()) as unknown as SignatureDoc[];
  return NextResponse.json({ signatures: docs.map(serialize) });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!body.name || !body.personName) {
    return NextResponse.json({ error: "name and personName required" }, { status: 400 });
  }
  const payload: Record<string, unknown> = {
    createdBy: normEmail(body.createdBy || ""),
    sharedWithRoles: Array.isArray(body.sharedWithRoles) ? body.sharedWithRoles : [],
    sharedWithPodIds: Array.isArray(body.sharedWithPodIds) ? body.sharedWithPodIds : [],
    sharedWithEmails: Array.isArray(body.sharedWithEmails) ? body.sharedWithEmails.map(normEmail) : [],
  };
  for (const f of STRUCTURED_FIELDS) {
    if (typeof body[f] === "string") payload[f] = body[f];
  }
  const doc = await Signature.create(payload);
  return NextResponse.json({ id: String(doc._id) });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, data } = body;
  if (!id || !data) return NextResponse.json({ error: "id and data required" }, { status: 400 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const f of STRUCTURED_FIELDS) {
    if (typeof data[f] === "string") patch[f] = data[f];
  }
  if (Array.isArray(data.sharedWithRoles)) patch.sharedWithRoles = data.sharedWithRoles;
  if (Array.isArray(data.sharedWithPodIds)) patch.sharedWithPodIds = data.sharedWithPodIds;
  if (Array.isArray(data.sharedWithEmails)) patch.sharedWithEmails = data.sharedWithEmails.map(normEmail);

  await Signature.findByIdAndUpdate(id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const actorRole = (req.nextUrl.searchParams.get("actorRole") || "").toLowerCase();
  if (actorRole !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await Signature.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
