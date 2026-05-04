import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingClient from "@/lib/models/onboarding/client";
import OnboardingAgentRun from "@/lib/models/onboarding/agent-run";
import OnboardingForm from "@/lib/models/onboarding/form";
import { runAllAgents, isAnthropicLive, type AgentInput } from "@/lib/onboarding/agents";

// Allow up to 5 minutes; live Claude runs for 4 agents typically take 30-90s.
export const maxDuration = 300;

interface ClientDoc {
  _id: { toString(): string };
  name: string;
  icp?: string;
  jobTitles?: string[];
  competitors?: string[];
}

interface FormDoc {
  answers?: Record<string, unknown>;
}

// POST { clientId, actorRole, actorEmail }
// Runs the 4-agent pipeline synchronously inside the function and writes
// one OnboardingAgentRun doc with all sub-results. Returns the run.
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

  // Pull the latest form submission for the form_answers payload.
  const form = await OnboardingForm.findOne({ clientId, status: "submitted" })
    .sort({ submittedAt: -1 })
    .lean<FormDoc>();

  const input: AgentInput = {
    clientName: client.name,
    icp: client.icp || "",
    jobTitles: client.jobTitles || [],
    competitors: client.competitors || [],
    answers: form?.answers || {},
  };

  // Seed the run doc upfront so the UI can show a "running" state if it polls.
  const seed = await OnboardingAgentRun.create({
    clientId,
    status: "running",
    agents: [],
    triggeredBy: (body.actorEmail || "").toLowerCase(),
    startedAt: new Date(),
    isLive: isAnthropicLive(),
  });
  const runId = String(seed._id);

  try {
    const results = await runAllAgents(input);

    const totalIn = results.reduce((s, r) => s + r.inputTokens, 0);
    const totalOut = results.reduce((s, r) => s + r.outputTokens, 0);
    const anyFailed = results.some((r) => r.status === "failed");
    const isLive = results.some((r) => r.isLive);

    await OnboardingAgentRun.findByIdAndUpdate(runId, {
      status: anyFailed ? "failed" : "complete",
      agents: results,
      completedAt: new Date(),
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      isLive,
    });

    const final = await OnboardingAgentRun.findById(runId).lean();
    return NextResponse.json({ run: serialize(final) });
  } catch (err: unknown) {
    await OnboardingAgentRun.findByIdAndUpdate(runId, {
      status: "failed",
      completedAt: new Date(),
    });
    return NextResponse.json({ error: err instanceof Error ? err.message : "agent run failed" }, { status: 500 });
  }
}

interface RunDoc {
  _id?: { toString(): string };
  clientId?: string;
  status?: string;
  agents?: unknown[];
  triggeredBy?: string;
  startedAt?: Date;
  completedAt?: Date | null;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  isLive?: boolean;
}

function serialize(d: unknown) {
  if (!d) return null;
  const r = d as RunDoc;
  return {
    id: r._id ? String(r._id) : "",
    clientId: r.clientId || "",
    status: r.status || "running",
    agents: r.agents || [],
    triggeredBy: r.triggeredBy || "",
    startedAt: r.startedAt || null,
    completedAt: r.completedAt || null,
    totalInputTokens: r.totalInputTokens || 0,
    totalOutputTokens: r.totalOutputTokens || 0,
    isLive: !!r.isLive,
  };
}
