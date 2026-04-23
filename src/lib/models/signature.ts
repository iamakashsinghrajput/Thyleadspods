import mongoose, { Schema } from "mongoose";

const modelName = "Signature";

const SignatureSchema = new Schema({
  name: { type: String, required: true },
  personName: { type: String, required: true },
  position: { type: String, default: "" },
  phone: { type: String, default: "" },
  addressLine1: { type: String, default: "" },
  addressLine2: { type: String, default: "" },
  linkedInUrl: { type: String, default: "" },
  websiteUrl: { type: String, default: "" },
  createdBy: { type: String, required: true },
  sharedWithRoles: { type: [String], default: [] },
  sharedWithPodIds: { type: [String], default: [] },
  sharedWithEmails: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { strict: false });

SignatureSchema.index({ createdAt: -1 });
SignatureSchema.index({ sharedWithRoles: 1 });
SignatureSchema.index({ sharedWithPodIds: 1 });
SignatureSchema.index({ sharedWithEmails: 1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, SignatureSchema);
