import mongoose, { Schema } from "mongoose";

const modelName = "OutboundAccount";

const OutboundAccountSchema = new Schema({
  pilotId: { type: String, required: true, index: true },
  domain: { type: String, required: true, index: true },
  name: { type: String, default: "" },
  industry: { type: String, default: "" },
  secondaryIndustries: { type: [String], default: [] },
  estimatedNumEmployees: { type: Number, default: 0 },
  organizationRevenuePrinted: { type: String, default: "" },
  foundedYear: { type: Number, default: 0 },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  country: { type: String, default: "" },
  ownedByOrganization: { type: String, default: "" },
  shortDescription: { type: String, default: "" },
  keywords: { type: [String], default: [] },
  dhMarketing: { type: Number, default: 0 },
  dhEngineering: { type: Number, default: 0 },
  dhProductManagement: { type: Number, default: 0 },
  dhSales: { type: Number, default: 0 },
  headcount6mGrowth: { type: Number, default: 0 },
  headcount12mGrowth: { type: Number, default: 0 },
  alexaRanking: { type: Number, default: 0 },
  linkedinUrl: { type: String, default: "" },
  publiclyTradedSymbol: { type: String, default: "" },
  source: { type: String, default: "" },
  score: { type: Number, default: 0 },
  segment: { type: String, default: "" },
  scoreBreakdown: { type: Schema.Types.Mixed, default: {} },
  rank: { type: Number, default: 0 },
  enriched: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { strict: false });

OutboundAccountSchema.index({ pilotId: 1, domain: 1 }, { unique: true });
OutboundAccountSchema.index({ pilotId: 1, score: -1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, OutboundAccountSchema);
