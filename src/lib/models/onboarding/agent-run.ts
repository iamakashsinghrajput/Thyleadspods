import mongoose, { Schema } from "mongoose";

const modelName = "OnboardingAgentRun";

// One run = one full pass of the 4-agent pipeline for a client.
// We store the four sub-results inline so the UI can render the whole
// run with a single read.
const AgentResultSchema = new Schema({
  kind: { type: String, required: true },          // "research" | "demand" | "icp" | "synthesis"
  status: { type: String, default: "running" },    // running | complete | failed
  output: { type: String, default: "" },           // markdown body
  data: { type: Schema.Types.Mixed, default: null },
  model: { type: String, default: "" },
  isLive: { type: Boolean, default: false },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  error: { type: String, default: "" },
}, { _id: false });

const OnboardingAgentRunSchema = new Schema({
  clientId: { type: String, required: true, index: true },
  status: { type: String, default: "running" },     // running | complete | failed
  agents: { type: [AgentResultSchema], default: [] },
  triggeredBy: { type: String, default: "" },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  totalInputTokens: { type: Number, default: 0 },
  totalOutputTokens: { type: Number, default: 0 },
  isLive: { type: Boolean, default: false },         // true if any sub-call hit real Anthropic
}, { strict: false });

OnboardingAgentRunSchema.index({ clientId: 1, startedAt: -1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, OnboardingAgentRunSchema);
