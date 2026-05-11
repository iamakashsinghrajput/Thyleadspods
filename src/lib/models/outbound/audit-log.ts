import mongoose, { Schema } from "mongoose";

const modelName = "OutboundAuditLog";

// Tracks operator-in-the-loop audit events:
//   I-1 sign-off (per-pilot, per-calibration-version)
//   I-3 quarterly audit completions (global, per-item)
//   Manual operator review notes
const OutboundAuditLogSchema = new Schema({
  kind: { type: String, enum: ["i1_sign_off", "i3_quarterly", "loop_review", "calibration_diff"], required: true, index: true },
  scope: { type: String, default: "" }, // "pilot:<id>" or "global" or "item:<name>"
  skillVersion: { type: String, default: "v7" },
  reviewer: { type: String, required: true, lowercase: true, trim: true },
  notes: { type: String, default: "" },
  payload: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
}, { strict: false });

OutboundAuditLogSchema.index({ kind: 1, scope: 1, createdAt: -1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, OutboundAuditLogSchema);
