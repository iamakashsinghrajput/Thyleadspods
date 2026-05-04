import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingForm from "@/lib/models/onboarding/form";

interface FormDoc {
  _id: { toString(): string };
  clientId: string;
  status?: string;
  answers?: Record<string, unknown>;
  submittedAt?: Date | null;
  createdAt?: Date;
}

// GET ?clientId=... → returns the latest submitted form's answers, or { answers: {} } if none.
export async function GET(req: NextRequest) {
  await connectDB();
  const clientId = req.nextUrl.searchParams.get("clientId") || "";
  if (!clientId) return NextResponse.json({ answers: {}, submittedAt: null });

  const doc = (await OnboardingForm.findOne({ clientId, status: "submitted" })
    .sort({ submittedAt: -1 })
    .lean()) as unknown as FormDoc | null;

  if (!doc) return NextResponse.json({ answers: {}, submittedAt: null });

  return NextResponse.json({
    answers: doc.answers || {},
    submittedAt: doc.submittedAt || null,
  });
}
