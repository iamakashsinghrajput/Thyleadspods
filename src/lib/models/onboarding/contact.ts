import mongoose, { Schema } from "mongoose";

const modelName = "OnboardingContact";

const OnboardingContactSchema = new Schema({
  clientId: { type: String, required: true, index: true },
  // Soft link — accountId is set when we can match the contact's company to an account row.
  accountId: { type: String, default: "" },
  companyName: { type: String, default: "" },
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  jobTitle: { type: String, default: "" },
  linkedinUrl: { type: String, default: "" },
  email: { type: String, default: "" },
  source: { type: String, default: "manual" }, // manual | sheet | apollo
  sheetRow: { type: Number, default: 0 },
  notes: { type: String, default: "" },
  createdBy: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { strict: false });

OnboardingContactSchema.index({ clientId: 1, createdAt: -1 });
OnboardingContactSchema.index({ accountId: 1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, OnboardingContactSchema);
