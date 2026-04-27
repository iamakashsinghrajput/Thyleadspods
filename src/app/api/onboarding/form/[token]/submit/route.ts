import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingForm from "@/lib/models/onboarding/form";
import OnboardingClient from "@/lib/models/onboarding/client";
import { sendEmail } from "@/lib/onboarding/email";
import { ONBOARDING_FIELDS, isAnswered, type OnboardingAnswers } from "@/lib/onboarding/form-fields";

interface FormDoc {
  _id: { toString(): string };
  clientId: string;
  status: string;
  expiresAt?: Date | null;
}

interface ClientDoc {
  _id: { toString(): string };
  name: string;
  ownerEmail?: string;
}

function normalizeAnswers(input: Record<string, unknown>): OnboardingAnswers {
  const out: OnboardingAnswers = {};
  for (const f of ONBOARDING_FIELDS) {
    const v = input[f.key];
    if (f.type === "tags") {
      if (Array.isArray(v)) {
        (out as Record<string, unknown>)[f.key] = v
          .filter((s) => typeof s === "string")
          .map((s) => (s as string).trim())
          .filter(Boolean);
      } else if (typeof v === "string") {
        (out as Record<string, unknown>)[f.key] = v.split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else if (f.type === "number") {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) (out as Record<string, unknown>)[f.key] = n;
    } else if (typeof v === "string") {
      (out as Record<string, unknown>)[f.key] = v.trim();
    }
  }
  return out;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  await connectDB();
  const { token } = await ctx.params;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const form = await OnboardingForm.findOne({ token }).lean<FormDoc>();
  if (!form) return NextResponse.json({ error: "not found" }, { status: 404 });

  const expired = form.expiresAt ? new Date(form.expiresAt).getTime() < Date.now() : false;
  if (expired) return NextResponse.json({ error: "form expired — request a fresh link" }, { status: 410 });

  const body = await req.json().catch(() => ({}));
  const rawAnswers = (body.answers || {}) as Record<string, unknown>;
  const answers = normalizeAnswers(rawAnswers);

  // Validate required fields server-side.
  const missing: string[] = [];
  for (const f of ONBOARDING_FIELDS) {
    if (!f.required) continue;
    if (!isAnswered(f, (answers as Record<string, unknown>)[f.key])) missing.push(f.key);
  }
  if (missing.length > 0) {
    return NextResponse.json({ error: "missing required fields", missing }, { status: 400 });
  }

  await OnboardingForm.findByIdAndUpdate(form._id, {
    answers,
    status: "submitted",
    submittedAt: new Date(),
    updatedAt: new Date(),
  });

  // Denormalize key answers onto the client doc + advance status to form_received.
  const client = await OnboardingClient.findById(form.clientId).lean<ClientDoc>();
  if (client) {
    await OnboardingClient.findByIdAndUpdate(client._id, {
      status: "form_received",
      formSubmittedAt: new Date(),
      icp: answers.icp || "",
      jobTitles: Array.isArray(answers.jobTitles) ? answers.jobTitles : [],
      competitors: Array.isArray(answers.competitors) ? answers.competitors : [],
      updatedAt: new Date(),
    });
  }

  // Email the GTM Engineer (client.ownerEmail) + ops with the structured answers.
  const internal = process.env.ONBOARDING_OPS_INBOX || "ops@thyleads.com";
  const recipients = Array.from(new Set([client?.ownerEmail, internal].filter(Boolean) as string[]));
  const summary = ONBOARDING_FIELDS.map((f) => {
    const v = (answers as Record<string, unknown>)[f.key];
    if (Array.isArray(v)) return `<strong>${f.label}:</strong> ${(v as string[]).join(", ") || "—"}`;
    if (v === undefined || v === null || v === "") return `<strong>${f.label}:</strong> —`;
    return `<strong>${f.label}:</strong> ${String(v)}`;
  }).map((line) => `<p style="margin:8px 0;">${line}</p>`).join("");
  const subject = `${client?.name || "Client"} — onboarding form submitted · over to GTM Engineer`;
  const bodyHtml = `
    <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:640px;line-height:1.5;">
      <p><strong>${client?.name || "Client"}</strong> just submitted their onboarding form.</p>
      <p>Your move, GTM Engineer — start finding accounts that match the ICP using Apollo (and manual research on top).</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
      ${summary}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
      <p style="font-size:12px;color:#64748b;">Open the Onboarding tab → expand this client to start.</p>
    </div>`;
  await sendEmail({
    to: recipients.length > 0 ? recipients : [internal],
    subject,
    bodyHtml,
    template: "form-submitted-to-gtme",
    payload: { clientId: form.clientId, answers },
    clientId: form.clientId,
  });

  return NextResponse.json({ ok: true });
}
