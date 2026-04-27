import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingClient from "@/lib/models/onboarding/client";
import OnboardingForm from "@/lib/models/onboarding/form";
import OnboardingAccount from "@/lib/models/onboarding/account";
import OnboardingContact from "@/lib/models/onboarding/contact";
import OnboardingEmailEvent from "@/lib/models/onboarding/email-event";
import { sendEmail } from "@/lib/onboarding/email";
import { STAGE_ORDER, type ClientStatus } from "@/lib/onboarding/stages";

interface ClientDoc {
  _id: { toString(): string };
  name: string;
  contactEmail?: string;
  status?: string;
  ownerEmail?: string;
  dataTeamEmail?: string;
  icp?: string;
  jobTitles?: string[];
  competitors?: string[];
  notes?: string;
  contractSignedAt?: Date;
  formSentAt?: Date | null;
  formSubmittedAt?: Date | null;
  accountsSentForApprovalAt?: Date | null;
  approvedByClientAt?: Date | null;
  readyAt?: Date | null;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VALID_STATUS = new Set<string>(STAGE_ORDER);

function serialize(d: ClientDoc) {
  return {
    id: String(d._id),
    name: d.name,
    contactEmail: d.contactEmail || "",
    status: (d.status || "new_client") as ClientStatus,
    ownerEmail: d.ownerEmail || "",
    dataTeamEmail: d.dataTeamEmail || "",
    icp: d.icp || "",
    jobTitles: d.jobTitles || [],
    competitors: d.competitors || [],
    notes: d.notes || "",
    contractSignedAt: d.contractSignedAt || null,
    formSentAt: d.formSentAt || null,
    formSubmittedAt: d.formSubmittedAt || null,
    accountsSentForApprovalAt: d.accountsSentForApprovalAt || null,
    approvedByClientAt: d.approvedByClientAt || null,
    readyAt: d.readyAt || null,
    createdBy: d.createdBy || "",
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function buildPayload(src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof src.name === "string") out.name = src.name.trim();
  if (typeof src.contactEmail === "string") out.contactEmail = src.contactEmail.trim().toLowerCase();
  if (typeof src.ownerEmail === "string") out.ownerEmail = src.ownerEmail.trim().toLowerCase();
  if (typeof src.dataTeamEmail === "string") out.dataTeamEmail = src.dataTeamEmail.trim().toLowerCase();
  if (typeof src.notes === "string") out.notes = src.notes;
  if (typeof src.status === "string" && VALID_STATUS.has(src.status)) out.status = src.status;
  return out;
}

export async function GET() {
  await connectDB();
  const docs = (await OnboardingClient.find({}).sort({ updatedAt: -1 }).lean()) as unknown as ClientDoc[];
  return NextResponse.json({ clients: docs.map(serialize) });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const payload = buildPayload(body);
  payload.createdBy = (body.createdBy || "").toLowerCase();
  payload.contractSignedAt = new Date();
  try {
    const doc = await OnboardingClient.create(payload);
    return NextResponse.json({ id: String(doc._id) });
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json({ error: "client name already exists" }, { status: 409 });
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
  const actorEmail = (body.actorEmail || "").toString().toLowerCase();

  // Action: client approves the account list. Stamps timestamp, advances
  // stage to data_team_extracting, fires email to the Data Team.
  if (action === "client-approve-accounts") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const c = await OnboardingClient.findById(id).lean<ClientDoc>();
    if (!c) return NextResponse.json({ error: "client not found" }, { status: 404 });

    const dataTeam = c.dataTeamEmail || "data@thyleads.com";
    const approvedCount = await OnboardingAccount.countDocuments({ clientId: id, approvalStatus: "approved" });

    await OnboardingClient.findByIdAndUpdate(id, {
      status: "data_team_extracting",
      approvedByClientAt: new Date(),
      updatedAt: new Date(),
    });

    const subject = `${c.name} — accounts approved · over to Data Team`;
    const bodyHtml = `
      <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:560px;line-height:1.5;">
        <p>The client has approved <strong>${approvedCount}</strong> account${approvedCount !== 1 ? "s" : ""} for ${c.name}.</p>
        <p><strong>Your task:</strong> source contacts for each account using LinkedIn Sales Nav.</p>
        <p>Capture per contact: <em>first name, last name, job title, LinkedIn URL</em> (email optional). Match the target job titles in the form.</p>
        <p>Upload to a Google Sheet (share as &quot;Anyone with the link can view&quot;). Then in the dashboard, paste the sheet URL and click <strong>Sync</strong> — rows import automatically.</p>
        <p>Target job titles: ${(c.jobTitles || []).map((t) => `<strong>${t}</strong>`).join(", ") || "<em>(none specified)</em>"}</p>
      </div>`;
    await sendEmail({
      to: dataTeam,
      subject,
      bodyHtml,
      template: "data-team-handoff",
      payload: { clientId: id, approvedCount },
      clientId: id,
      triggeredBy: actorEmail,
    });

    return NextResponse.json({ ok: true });
  }

  // Action: Data Team marks done → status: ready.
  if (action === "mark-ready") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await OnboardingClient.findByIdAndUpdate(id, {
      status: "ready",
      readyAt: new Date(),
      updatedAt: new Date(),
    });
    return NextResponse.json({ ok: true });
  }

  // Default field patch
  const { id, data } = body;
  if (!id || !data) return NextResponse.json({ error: "id and data required" }, { status: 400 });
  const patch = buildPayload(data);
  patch.updatedAt = new Date();
  await OnboardingClient.findByIdAndUpdate(id, patch);
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

  await Promise.all([
    OnboardingForm.deleteMany({ clientId: id }),
    OnboardingAccount.deleteMany({ clientId: id }),
    OnboardingContact.deleteMany({ clientId: id }),
    OnboardingEmailEvent.deleteMany({ clientId: id }),
  ]);
  await OnboardingClient.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
