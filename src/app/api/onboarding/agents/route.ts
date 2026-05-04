import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingAgentRun from "@/lib/models/onboarding/agent-run";

interface RunDoc {
  _id: { toString(): string };
  clientId: string;
  status: string;
  agents: unknown[];
  triggeredBy: string;
  startedAt: Date;
  completedAt: Date | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  isLive: boolean;
}

function serialize(d: RunDoc) {
  return {
    id: String(d._id),
    clientId: d.clientId,
    status: d.status || "running",
    agents: d.agents || [],
    triggeredBy: d.triggeredBy || "",
    startedAt: d.startedAt || null,
    completedAt: d.completedAt || null,
    totalInputTokens: d.totalInputTokens || 0,
    totalOutputTokens: d.totalOutputTokens || 0,
    isLive: !!d.isLive,
  };
}

// GET ?clientId=... → returns the latest run for the client (or null).
// GET ?clientId=...&history=1 → returns up to 10 runs newest-first.
export async function GET(req: NextRequest) {
  await connectDB();
  const clientId = req.nextUrl.searchParams.get("clientId") || "";
  if (!clientId) return NextResponse.json({ run: null, runs: [] });

  const wantsHistory = req.nextUrl.searchParams.get("history") === "1";

  if (wantsHistory) {
    const docs = (await OnboardingAgentRun.find({ clientId })
      .sort({ startedAt: -1 })
      .limit(10)
      .lean()) as unknown as RunDoc[];
    return NextResponse.json({ runs: docs.map(serialize) });
  }

  const doc = (await OnboardingAgentRun.findOne({ clientId })
    .sort({ startedAt: -1 })
    .lean()) as unknown as RunDoc | null;
  return NextResponse.json({ run: doc ? serialize(doc) : null });
}

// DELETE ?id=... → remove a run (admin/superadmin only).
export async function DELETE(req: NextRequest) {
  await connectDB();
  const actorRole = (req.nextUrl.searchParams.get("actorRole") || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await OnboardingAgentRun.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
