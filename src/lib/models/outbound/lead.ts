import mongoose, { Schema } from "mongoose";

const modelName = "OutboundLead";

const OutboundLeadSchema = new Schema({
  pilotId: { type: String, required: true, index: true },
  accountDomain: { type: String, required: true, index: true },
  personKey: { type: String, default: "", index: true },
  companyShort: { type: String, default: "" },
  companyFull: { type: String, default: "" },
  industry: { type: String, default: "" },
  employees: { type: Number, default: 0 },
  country: { type: String, default: "" },
  score: { type: Number, default: 0 },
  segment: { type: String, default: "" },
  rank: { type: Number, default: 0 },
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  fullName: { type: String, default: "" },
  contactTitle: { type: String, default: "" },
  contactLinkedinUrl: { type: String, default: "" },
  contactSeniority: { type: String, default: "" },
  pickedReason: { type: String, default: "" },
  email: { type: String, default: "" },
  emailStatus: { type: String, default: "" },
  observationAngle: { type: String, default: "" },
  secondaryObservation: { type: String, default: "" },
  signalForBody3: { type: String, default: "" },
  theirCustomers: { type: String, default: "" },
  whatTheySell: { type: String, default: "" },
  theirStage: { type: String, default: "" },
  topPain: { type: String, default: "" },
  valueAngle: { type: String, default: "" },
  socialProofMatch: { type: [String], default: [] },
  subjectTopic: { type: String, default: "" },
  socialAngle: { type: String, default: "" },
  personEvidence: { type: [String], default: [] },
  icpRole: { type: String, default: "" },
  evidenceList: { type: [String], default: [] },
  buyingHypothesis: { type: String, default: "" },
  shouldEmail: { type: String, default: "" },
  shouldEmailReason: { type: String, default: "" },
  confidenceLevel: { type: String, default: "" },
  buyerSignalScore: { type: Number, default: 0 },
  subject1: { type: String, default: "" },
  body1: { type: String, default: "" },
  subject2: { type: String, default: "" },
  body2: { type: String, default: "" },
  subject3: { type: String, default: "" },
  body3: { type: String, default: "" },
  validationIssues: { type: [String], default: [] },
  shippable: { type: Boolean, default: false },
  claudePrompt: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { strict: false });

OutboundLeadSchema.index({ pilotId: 1, rank: 1 });
OutboundLeadSchema.index({ pilotId: 1, accountDomain: 1 });
OutboundLeadSchema.index({ pilotId: 1, accountDomain: 1, personKey: 1 }, { unique: true });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

const Model = mongoose.model(modelName, OutboundLeadSchema);

const g = globalThis as unknown as { __outboundLeadIndexFixed?: boolean };
if (!g.__outboundLeadIndexFixed) {
  g.__outboundLeadIndexFixed = true;
  Model.syncIndexes().catch(() => {});
}

export default Model;
