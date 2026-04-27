import mongoose, { Schema } from "mongoose";

const modelName = "OnboardingEmailEvent";

// Audit log of every email this flow fires (real or mock).
const OnboardingEmailEventSchema = new Schema({
  to: { type: [String], required: true },
  from: { type: String, default: "" },
  subject: { type: String, required: true },
  template: { type: String, default: "" },
  payload: { type: Schema.Types.Mixed, default: {} },
  bodyHtml: { type: String, default: "" },
  provider: { type: String, default: "mock" }, // mock | resend
  providerId: { type: String, default: "" },
  status: { type: String, default: "queued", index: true }, // queued | sent | failed
  error: { type: String, default: "" },
  clientId: { type: String, default: "", index: true },
  triggeredBy: { type: String, default: "" },
  sentAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
}, { strict: false });

OnboardingEmailEventSchema.index({ createdAt: -1 });
OnboardingEmailEventSchema.index({ clientId: 1, createdAt: -1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, OnboardingEmailEventSchema);
