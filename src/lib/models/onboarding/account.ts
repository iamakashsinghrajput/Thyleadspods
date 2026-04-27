import mongoose, { Schema } from "mongoose";

const modelName = "OnboardingAccount";

const OnboardingAccountSchema = new Schema({
  clientId: { type: String, required: true, index: true },
  companyName: { type: String, required: true },
  domain: { type: String, default: "" },
  websiteUrl: { type: String, default: "" },
  linkedinUrl: { type: String, default: "" },
  industry: { type: String, default: "" },
  employeeCount: { type: Number, default: 0 },
  // How this account got into the list
  source: { type: String, default: "manual" }, // manual | apollo | apollo-mock | sheet
  // Client-approval state
  approvalStatus: { type: String, default: "pending", index: true }, // pending | approved | rejected
  rejectionReason: { type: String, default: "" },
  notes: { type: String, default: "" },
  createdBy: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { strict: false });

OnboardingAccountSchema.index({ clientId: 1, companyName: 1 }, { unique: true });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, OnboardingAccountSchema);
