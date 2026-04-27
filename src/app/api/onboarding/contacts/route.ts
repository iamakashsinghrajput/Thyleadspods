import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingContact from "@/lib/models/onboarding/contact";

interface ContactDoc {
  _id: { toString(): string };
  clientId: string;
  accountId?: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  email?: string;
  source?: string;
  sheetRow?: number;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

function serialize(d: ContactDoc) {
  return {
    id: String(d._id),
    clientId: d.clientId,
    accountId: d.accountId || "",
    companyName: d.companyName || "",
    firstName: d.firstName || "",
    lastName: d.lastName || "",
    jobTitle: d.jobTitle || "",
    linkedinUrl: d.linkedinUrl || "",
    email: d.email || "",
    source: d.source || "manual",
    sheetRow: d.sheetRow || 0,
    notes: d.notes || "",
    createdBy: d.createdBy || "",
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function buildPayload(src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof src.companyName === "string") out.companyName = src.companyName.trim();
  if (typeof src.accountId === "string") out.accountId = src.accountId;
  if (typeof src.firstName === "string") out.firstName = src.firstName.trim();
  if (typeof src.lastName === "string") out.lastName = src.lastName.trim();
  if (typeof src.jobTitle === "string") out.jobTitle = src.jobTitle.trim();
  if (typeof src.linkedinUrl === "string") out.linkedinUrl = src.linkedinUrl.trim();
  if (typeof src.email === "string") out.email = src.email.trim().toLowerCase();
  if (typeof src.source === "string") out.source = src.source;
  if (typeof src.notes === "string") out.notes = src.notes;
  return out;
}

export async function GET(req: NextRequest) {
  await connectDB();
  const clientId = req.nextUrl.searchParams.get("clientId") || "";
  const filter: Record<string, unknown> = {};
  if (clientId) filter.clientId = clientId;
  const docs = (await OnboardingContact.find(filter).sort({ createdAt: -1 }).limit(5000).lean()) as unknown as ContactDoc[];
  return NextResponse.json({ contacts: docs.map(serialize) });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!body.clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  const payload = buildPayload(body);
  payload.clientId = body.clientId;
  payload.createdBy = (body.createdBy || "").toLowerCase();
  const doc = await OnboardingContact.create(payload);
  return NextResponse.json({ id: String(doc._id) });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, data } = body;
  if (!id || !data) return NextResponse.json({ error: "id and data required" }, { status: 400 });
  const patch = buildPayload(data);
  patch.updatedAt = new Date();
  await OnboardingContact.findByIdAndUpdate(id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const actorRole = (req.nextUrl.searchParams.get("actorRole") || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await OnboardingContact.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
