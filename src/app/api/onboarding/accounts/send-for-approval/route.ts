import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingClient from "@/lib/models/onboarding/client";
import OnboardingAccount from "@/lib/models/onboarding/account";
import { sendEmail } from "@/lib/onboarding/email";

interface ClientDoc {
  _id: { toString(): string };
  name: string;
  contactEmail?: string;
  status?: string;
}

interface AccountDoc {
  companyName: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
  linkedinUrl?: string;
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const clientId = (body.clientId || "").toString();
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const client = await OnboardingClient.findById(clientId).lean<ClientDoc>();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  const recipient = (body.recipientEmail || client.contactEmail || "").toString().trim().toLowerCase();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return NextResponse.json({ error: "valid recipientEmail required (or set client contactEmail)" }, { status: 400 });
  }

  const accounts = await OnboardingAccount.find({ clientId, approvalStatus: "pending" })
    .sort({ companyName: 1 })
    .lean<AccountDoc[]>();
  if (accounts.length === 0) {
    return NextResponse.json({ error: "no pending accounts to send" }, { status: 400 });
  }

  const rows = accounts.map((a) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;"><strong>${a.companyName}</strong></td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">${a.domain || ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">${a.industry || ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">${a.employeeCount || "—"}</td>
    </tr>`).join("");

  const subject = `${client.name} — please review the proposed account list (${accounts.length})`;
  const bodyHtml = `
    <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:680px;line-height:1.5;">
      <p>Hi,</p>
      <p>Below are the <strong>${accounts.length}</strong> account${accounts.length !== 1 ? "s" : ""} we&apos;ve identified that match the ICP from your onboarding form.</p>
      <p>Please reply with <strong>approved</strong> (whole list) or with the names of any accounts you&apos;d like us to remove.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:12px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;">Company</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;">Domain</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;">Industry</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#475569;">Employees</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px;">— Thyleads</p>
    </div>`;

  await OnboardingClient.findByIdAndUpdate(clientId, {
    status: "awaiting_approval",
    accountsSentForApprovalAt: new Date(),
    updatedAt: new Date(),
  });

  await sendEmail({
    to: recipient,
    subject,
    bodyHtml,
    template: "accounts-for-client-approval",
    payload: { clientId, count: accounts.length },
    clientId,
    triggeredBy: (body.actorEmail || "").toString().toLowerCase(),
  });

  return NextResponse.json({ ok: true, sentCount: accounts.length });
}
