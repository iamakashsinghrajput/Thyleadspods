import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingForm from "@/lib/models/onboarding/form";
import OnboardingClient from "@/lib/models/onboarding/client";
import { ONBOARDING_FIELDS } from "@/lib/onboarding/form-fields";

interface FormDoc {
  _id: { toString(): string };
  clientId: string;
  status: string;
  answers?: Record<string, unknown>;
  submittedAt?: Date | null;
  expiresAt?: Date | null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  await connectDB();
  const { token } = await ctx.params;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const form = await OnboardingForm.findOne({ token }).lean<FormDoc>();
  if (!form) return NextResponse.json({ error: "not found" }, { status: 404 });

  const expired = form.expiresAt ? new Date(form.expiresAt).getTime() < Date.now() : false;
  if (expired && form.status === "pending") {
    await OnboardingForm.findByIdAndUpdate(form._id, { status: "expired" });
  }

  const client = await OnboardingClient.findById(form.clientId).lean<{ name: string }>();

  return NextResponse.json({
    token,
    status: expired ? "expired" : form.status,
    submittedAt: form.submittedAt || null,
    answers: form.answers || {},
    clientName: client?.name || "",
    fields: ONBOARDING_FIELDS,
  });
}
