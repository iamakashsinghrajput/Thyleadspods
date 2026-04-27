import mongoose, { Schema } from "mongoose";

const modelName = "OnboardingFormSubmission";

const OnboardingFormSchema = new Schema({
  clientId: { type: String, required: true, index: true },
  token: { type: String, required: true, unique: true, index: true },
  status: { type: String, default: "pending", index: true }, // pending | submitted | expired
  answers: { type: Schema.Types.Mixed, default: {} },
  submittedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { strict: false });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, OnboardingFormSchema);
