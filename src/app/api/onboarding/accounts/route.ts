import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingAccount from "@/lib/models/onboarding/account";
import OnboardingClient from "@/lib/models/onboarding/client";

interface AccountDoc {
  _id: { toString(): string };
  clientId: string;
  companyName: string;
  domain?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  industry?: string;
  employeeCount?: number;
  source?: string;
  approvalStatus?: string;
  rejectionReason?: string;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VALID_APPROVAL = new Set(["pending", "approved", "rejected"]);

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function serialize(d: AccountDoc) {
  return {
    id: String(d._id),
    clientId: d.clientId,
    companyName: d.companyName,
    domain: d.domain || "",
    websiteUrl: d.websiteUrl || "",
    linkedinUrl: d.linkedinUrl || "",
    industry: d.industry || "",
    employeeCount: num(d.employeeCount),
    source: d.source || "manual",
    approvalStatus: d.approvalStatus || "pending",
    rejectionReason: d.rejectionReason || "",
    notes: d.notes || "",
    createdBy: d.createdBy || "",
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function buildPayload(src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof src.companyName === "string") out.companyName = src.companyName.trim();
  if (typeof src.domain === "string") out.domain = src.domain.trim().toLowerCase();
  if (typeof src.websiteUrl === "string") out.websiteUrl = src.websiteUrl.trim();
  if (typeof src.linkedinUrl === "string") out.linkedinUrl = src.linkedinUrl.trim();
  if (typeof src.industry === "string") out.industry = src.industry;
  if (typeof src.employeeCount === "number") out.employeeCount = src.employeeCount;
  if (typeof src.source === "string") out.source = src.source;
  if (typeof src.approvalStatus === "string" && VALID_APPROVAL.has(src.approvalStatus)) out.approvalStatus = src.approvalStatus;
  if (typeof src.rejectionReason === "string") out.rejectionReason = src.rejectionReason;
  if (typeof src.notes === "string") out.notes = src.notes;
  return out;
}

export async function GET(req: NextRequest) {
  await connectDB();
  const clientId = req.nextUrl.searchParams.get("clientId") || "";
  const filter: Record<string, unknown> = {};
  if (clientId) filter.clientId = clientId;
  const docs = (await OnboardingAccount.find(filter).sort({ createdAt: -1 }).limit(2000).lean()) as unknown as AccountDoc[];
  return NextResponse.json({ accounts: docs.map(serialize) });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!body.clientId || !body.companyName) {
    return NextResponse.json({ error: "clientId and companyName required" }, { status: 400 });
  }

  // First account on a client moves status from form_received → accounts_in_progress.
  const client = await OnboardingClient.findById(body.clientId).lean<{ status?: string }>();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  const payload = buildPayload(body);
  payload.clientId = body.clientId;
  payload.createdBy = (body.createdBy || "").toLowerCase();

  try {
    const doc = await OnboardingAccount.create(payload);
    if (client.status === "form_received") {
      await OnboardingClient.findByIdAndUpdate(body.clientId, { status: "accounts_in_progress", updatedAt: new Date() });
    }
    return NextResponse.json({ id: String(doc._id) });
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json({ error: "company already in this client's universe" }, { status: 409 });
    }
    return NextResponse.json({ error: "create failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const action = (body.action || "").toString();

  // Bulk-approve or bulk-reject all accounts for a client (used when a client
  // approves the whole list at once, e.g. on the approval CTA).
  if (action === "approve-all" || action === "reject-all") {
    const clientId = (body.clientId || "").toString();
    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
    const next = action === "approve-all" ? "approved" : "rejected";
    const result = await OnboardingAccount.updateMany(
      { clientId, approvalStatus: "pending" },
      { $set: { approvalStatus: next, updatedAt: new Date() } }
    );
    return NextResponse.json({ ok: true, modified: result.modifiedCount ?? 0 });
  }

  const { id, data } = body;
  if (!id || !data) return NextResponse.json({ error: "id and data required" }, { status: 400 });
  const patch = buildPayload(data);
  patch.updatedAt = new Date();
  await OnboardingAccount.findByIdAndUpdate(id, patch);
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
  await OnboardingAccount.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
