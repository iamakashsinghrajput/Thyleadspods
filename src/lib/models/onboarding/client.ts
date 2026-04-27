import mongoose, { Schema } from "mongoose";

const modelName = "OnboardingClient";

// Single status field tracks the linear journey:
// new_client → form_pending → form_received → accounts_in_progress
// → awaiting_approval → data_team_extracting → ready
const OnboardingClientSchema = new Schema({
  name: { type: String, required: true },
  contactEmail: { type: String, default: "" },           // client's email — receives the form + approval emails
  status: { type: String, default: "new_client", index: true },
  ownerEmail: { type: String, default: "" },             // GTM Engineer email
  dataTeamEmail: { type: String, default: "" },          // Data Team email
  // ICP captured from the form once it's submitted (denormalized for fast UI rendering)
  icp: { type: String, default: "" },
  jobTitles: { type: [String], default: [] },
  competitors: { type: [String], default: [] },
  notes: { type: String, default: "" },
  // Timestamps for each milestone
  contractSignedAt: { type: Date, default: Date.now },
  formSentAt: { type: Date, default: null },
  formSubmittedAt: { type: Date, default: null },
  accountsSentForApprovalAt: { type: Date, default: null },
  approvedByClientAt: { type: Date, default: null },
  readyAt: { type: Date, default: null },
  createdBy: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { strict: false });

OnboardingClientSchema.index({ name: 1 }, { unique: true });
OnboardingClientSchema.index({ status: 1, updatedAt: -1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, OnboardingClientSchema);
