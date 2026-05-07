import mongoose, { Schema } from "mongoose";

const modelName = "OutboundPilot";

const PhaseStateSchema = new Schema({
  key: { type: String, required: true },
  status: { type: String, default: "pending" },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  durationMs: { type: Number, default: 0 },
  inputCount: { type: Number, default: 0 },
  outputCount: { type: Number, default: 0 },
  metrics: { type: Schema.Types.Mixed, default: {} },
  log: { type: [String], default: [] },
  error: { type: String, default: "" },
  apolloCreditsUsed: { type: Number, default: 0 },
  llmTokensIn: { type: Number, default: 0 },
  llmTokensOut: { type: Number, default: 0 },
  artifactKey: { type: String, default: "" },
}, { _id: false });

const InputsSchema = new Schema({
  targets: { type: [String], default: [] },
  dnc: { type: [String], default: [] },
  activeCustomers: { type: [String], default: [] },
  pastMeetings: { type: [String], default: [] },
  sellerDomains: { type: [String], default: [] },
  pastMeetingTokens: { type: [String], default: [] },
}, { _id: false });

const ClientBriefSchema = new Schema({
  sellerProduct: { type: String, default: "" },
  sellerOneLineValue: { type: String, default: "" },
  sellerCapabilities: { type: [String], default: [] },
  sellerUsps: { type: [String], default: [] },
  targetSegments: { type: [String], default: [] },
  targetPersonas: { type: [String], default: [] },
  commonPainsSolved: { type: [String], default: [] },
  caseStudyWins: { type: [String], default: [] },
  antiIcp: { type: [String], default: [] },
  notes: { type: String, default: "" },
}, { _id: false });

const InsightStrategySchema = new Schema({
  championTitles: { type: [String], default: [] },
  buyerJourneyTitles: { type: [String], default: [] },
  postKeywords: { type: [String], default: [] },
  intentSignalsToPrioritize: { type: [String], default: [] },
  jobTitleKeywordsHiring: { type: [String], default: [] },
  techStackToWatch: { type: [String], default: [] },
  rationale: { type: String, default: "" },
  generatedAt: { type: Date, default: null },
  generatedBy: { type: String, default: "" },
  llmTokensIn: { type: Number, default: 0 },
  llmTokensOut: { type: Number, default: 0 },
}, { _id: false });

const ConfigSchema = new Schema({
  geoFocus: { type: String, default: "India" },
  priorityTlds: { type: [String], default: ["in", "co.in", "ac.in", "org.in", "net.in", "bank.in"] },
  enrichSubsetCap: { type: Number, default: 1500 },
  topNAfterScore: { type: Number, default: 500 },
  maxPerIndustry: { type: Number, default: 50 },
  apolloCreditsBudget: { type: Number, default: 1500 },
  bulkEnrichTopN: { type: Number, default: 0 },
  useFreeSearchFirst: { type: Boolean, default: true },
  useAi: { type: Boolean, default: false },
  scoringVersion: { type: String, default: "v2" },
  geographyHardFilter: { type: [String], default: ["India"] },
  industryWeights: { type: Schema.Types.Mixed, default: {} },
  antiIcpIndustries: { type: [String], default: [
    "government administration", "defense & space", "gambling & casinos",
    "tobacco", "firearms", "religious institutions", "libraries",
  ] },
  highFitKeywords: { type: [String], default: ["d2c", "ecommerce", "fintech", "edtech", "b2c", "saas", "marketplace", "subscription"] },
  championTitles: { type: [String], default: [
    "Head of Growth", "VP Growth", "Head of Marketing", "Head of Digital Marketing",
    "CMO", "VP Marketing", "Senior Product Manager", "Head of Product", "VP Product",
    "Head of D2C", "Head of Ecommerce", "Director of Growth", "Director Marketing",
    "Head of CRO", "Head of Optimization", "Head of Experimentation",
  ] },
  championTitlesRelaxed: { type: [String], default: [
    "Marketing Manager", "Growth Manager", "Product Manager",
    "Founder", "Co-Founder", "CEO",
  ] },
  directCompetitors: { type: [String], default: [
    "optimizely.com", "abtasty.com", "mida.so", "convert.com",
    "kameleoon.com", "webtrends.com", "omniconvert.com",
  ] },
  partnerAgencies: { type: [String], default: [] },
  competitorCustomerDb: { type: Schema.Types.Mixed, default: {} },
  provenSubsegments: { type: Schema.Types.Mixed, default: {
    "D2C-Apparel": 1.10, "D2C-Beauty": 1.05, "D2C-Wellness": 1.05,
    "Fintech-Wealth": 1.05, "Fintech-Lending": 1.05,
    "BFSI-Bank": 1.05, "BFSI-Wealth": 1.05,
    "Health-Diagnostics": 1.05,
    "EdTech-TestPrep": 1.03, "EdTech-Upskilling": 1.03,
  } },
  employeeSweetSpotMin: { type: Number, default: 50 },
  employeeSweetSpotMax: { type: Number, default: 1500 },
  alexaHardFilterMax: { type: Number, default: 2_000_000 },
  socialProofLibrary: { type: Schema.Types.Mixed, default: {} },
  sellerName: { type: String, default: "VWO" },
}, { _id: false });

const OutboundPilotSchema = new Schema({
  clientName: { type: String, default: "VWO", index: true },
  pilotName: { type: String, required: true },
  status: { type: String, default: "draft" },
  config: { type: ConfigSchema, default: () => ({}) },
  clientBrief: { type: ClientBriefSchema, default: () => ({}) },
  insightStrategy: { type: InsightStrategySchema, default: () => ({}) },
  inputs: { type: InputsSchema, default: () => ({}) },
  phases: { type: [PhaseStateSchema], default: [] },
  totalApolloCredits: { type: Number, default: 0 },
  totalLlmTokensIn: { type: Number, default: 0 },
  totalLlmTokensOut: { type: Number, default: 0 },
  finalCsv: { type: String, default: "" },
  cancelRequested: { type: Boolean, default: false },
  cancelRequestedAt: { type: Date, default: null },
  cancelRequestedBy: { type: String, default: "" },
  skillContent: { type: String, default: "" },
  skillVersion: { type: String, default: "v6" },
  skillUpdatedAt: { type: Date, default: null },
  skillUpdatedBy: { type: String, default: "" },
  createdBy: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { strict: false });

OutboundPilotSchema.index({ clientName: 1, createdAt: -1 });
OutboundPilotSchema.index({ updatedAt: -1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, OutboundPilotSchema);
