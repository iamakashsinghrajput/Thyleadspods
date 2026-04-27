import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import OnboardingClient from "@/lib/models/onboarding/client";
import OnboardingForm from "@/lib/models/onboarding/form";
import { sendEmail } from "@/lib/onboarding/email";

const TTL_DAYS = 14;

function originFromReq(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const clientId = (body.clientId || "").toString();
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const client = await OnboardingClient.findById(clientId).lean<{ _id: { toString(): string }; name: string; contactEmail?: string }>();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  const recipient = (body.recipientEmail || client.contactEmail || "").toString().trim().toLowerCase();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return NextResponse.json({ error: "valid recipientEmail required (or set client contactEmail)" }, { status: 400 });
  }

  // Reuse the pending form if one exists; otherwise mint a new token.
  let form = await OnboardingForm.findOne({ clientId, status: "pending" }).lean<{ _id: { toString(): string }; token: string }>();
  if (!form) {
    const token = crypto.randomBytes(24).toString("base64url");
    const created = await OnboardingForm.create({
      clientId,
      token,
      status: "pending",
      expiresAt: new Date(Date.now() + TTL_DAYS * 86400 * 1000),
    });
    form = { _id: created._id as { toString(): string }, token: (created.toObject() as { token: string }).token };
  }

  const url = `${originFromReq(req)}/onboarding-form/${form.token}`;

  // Advance status: new_client → form_pending. Stamp formSentAt + contactEmail
  // (in case it was passed in this call rather than at create-time).
  await OnboardingClient.findByIdAndUpdate(clientId, {
    status: "form_pending",
    formSentAt: new Date(),
    contactEmail: recipient,
    updatedAt: new Date(),
  });

  const subject = `${client.name} — kickoff onboarding form`;
  const bodyHtml = `
    <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:560px;line-height:1.5;">
      <p>Hi,</p>
      <p>Welcome aboard. To kick off the engagement we need a few inputs from you — about 5 minutes.</p>
      <p><a href="${url}" style="display:inline-block;background:#6800FF;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open your onboarding form</a></p>
      <p style="font-size:12px;color:#64748b;">Or paste this link: <a href="${url}">${url}</a></p>
      <p style="font-size:12px;color:#64748b;">Link expires in ${TTL_DAYS} days. Reply to this email if anything is unclear.</p>
      <p>— Thyleads</p>
    </div>`;
  const result = await sendEmail({
    to: recipient,
    subject,
    bodyHtml,
    template: "onboarding-form-link",
    payload: { clientId, url, clientName: client.name },
    clientId,
    triggeredBy: (body.actorEmail || "").toString().toLowerCase(),
  });

  return NextResponse.json({
    ok: true,
    url,
    token: form.token,
    formId: String(form._id),
    email: result,
  });
}
