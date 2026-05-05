import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import { sendMail } from "@/lib/mailer";

export const maxDuration = 30;

function isSuperadmin(email: string): boolean {
  return (email || "").toLowerCase() === SUPERADMIN_EMAIL;
}

const VALID_ROLES = ["admin", "pod", "client"] as const;
type InviteRole = typeof VALID_ROLES[number];

function inviteEmailHtml(args: { inviteUrl: string; inviterName: string; recipientName: string; role: string }): string {
  const { inviteUrl, inviterName, recipientName, role } = args;
  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#0f172a;background:#f8fafc;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#6800ff 0%,#9b00ff 100%);padding:24px 28px;color:#fff">
      <p style="margin:0;font-size:13px;opacity:0.85;letter-spacing:.04em;text-transform:uppercase;font-weight:700">Thyleads dashboard</p>
      <h1 style="margin:6px 0 0;font-size:22px;font-weight:700">You're invited, ${escapeHtml(recipientName)}</h1>
    </div>
    <div style="padding:24px 28px">
      <p style="margin:0 0 12px">${escapeHtml(inviterName)} has added you as <strong>${escapeHtml(role)}</strong> on the Thyleads internal dashboard.</p>
      <p style="margin:0 0 18px">Click below to set up your account. You can sign in with your Google Workspace account or create a password — whichever you prefer.</p>
      <p style="margin:0 0 18px"><a href="${inviteUrl}" style="display:inline-block;background:#6800ff;color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:8px">Accept invite &rarr;</a></p>
      <p style="margin:0 0 4px;font-size:12px;color:#64748b">If the button doesn't work, copy this link into your browser:</p>
      <p style="margin:0;font-size:11px;font-family:ui-monospace,Menlo,monospace;color:#475569;word-break:break-all">${inviteUrl}</p>
      <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:11px;color:#94a3b8">This invitation expires in 7 days. If you weren't expecting this email, you can safely ignore it.</p>
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function originFromReq(req: NextRequest): string {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/+$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actor = String(body.actor || "");
  if (!isSuperadmin(actor)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const email = String(body.email || "").toLowerCase().trim();
  const name = String(body.name || "").trim();
  const role = (String(body.role || "pod").toLowerCase().trim()) as InviteRole;
  const podId = String(body.podId || "").trim();

  if (!email || !name) return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  if (!email.includes("@")) return NextResponse.json({ error: "invalid email" }, { status: 400 });
  if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: `role must be one of ${VALID_ROLES.join(", ")}` }, { status: 400 });

  const allowed = email.endsWith("@thyleads.com") || email === "akash21052000singh@gmail.com";
  if (!allowed) return NextResponse.json({ error: "Only @thyleads.com email addresses are allowed" }, { status: 400 });

  const existing = await UserModel.findOne({ email }).lean<{ _id: { toString(): string }; verified?: boolean }>();
  if (existing && existing.verified) {
    return NextResponse.json({ error: "User already has a verified account" }, { status: 400 });
  }

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const update = {
    name, email, role, podId,
    inviteToken: token,
    inviteTokenExpiresAt: expiresAt,
    invitedBy: actor.toLowerCase(),
    invitedAt: new Date(),
    status: "approved" as const,
    verified: false,
  };

  if (existing) {
    await UserModel.updateOne({ _id: existing._id }, { $set: update });
  } else {
    await UserModel.create(update);
  }

  const inviteUrl = `${originFromReq(req)}/invite/${token}`;
  const result = await sendMail({
    to: email,
    subject: `You're invited to the Thyleads dashboard`,
    html: inviteEmailHtml({ inviteUrl, inviterName: "Akash @ Thyleads", recipientName: name, role }),
    fromName: "Thyleads",
  });

  return NextResponse.json({
    ok: true,
    email, name, role,
    expiresAt,
    invite: { sent: result.ok, provider: result.provider, error: result.error || null, messageId: result.messageId || null },
    inviteUrl: process.env.NODE_ENV !== "production" ? inviteUrl : undefined,
  });
}
