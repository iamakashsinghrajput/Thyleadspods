import mongoose, { Schema } from "mongoose";

const modelName = "OutboundCampaignOutcome";

// Captures the run-level metrics + calibration snapshot for every pipeline run.
// Used by the I-2 weekly diff + self-learning loops to measure calibration drift over time.
const OutboundCampaignOutcomeSchema = new Schema({
  pilotId: { type: String, required: true, index: true },
  runId: { type: String, required: true, unique: true },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
  status: { type: String, enum: ["running", "complete", "failed", "cancelled"], default: "running" },

  // Snapshot of the calibration overlay active during this run (V-VWO sign-off snapshot)
  calibrationSnapshot: {
    skillVersion: { type: String, default: "v7" },
    sellerName: { type: String, default: "" },
    apifyDisabled: { type: Boolean, default: false },
    coreSignalTierAOnly: { type: Boolean, default: false },
    coreSignalCreditsBudget: { type: Number, default: 10 },
    bucketThresholds: { type: [Number], default: [95, 75, 55, 35] },
    competitorPenaltyDirect: { type: Number, default: 0.2 },
    competitorPenaltyAdjacent: { type: Number, default: 0.5 },
    fiscalCalendarMultiplier: { type: Number, default: 1.0 },
    fiscalCalendarWindow: { type: String, default: "regular" },
    socialProofLibrarySize: { type: Number, default: 0 },
    exclusionGroupCount: { type: Number, default: 0 },
    intentSignalWeights: { type: Schema.Types.Mixed, default: {} },
  },

  // Run inputs
  inputs: {
    targets: { type: Number, default: 0 },
    accountDomains: { type: [String], default: [] },
    testLimit: { type: Number, default: 0 },
    accountLimit: { type: Number, default: 0 },
    accountOffset: { type: Number, default: 0 },
    coreSignalOnly: { type: Boolean, default: false },
    personalize: { type: Boolean, default: false },
    forceRegenerate: { type: Boolean, default: false },
  },

  // Phase metrics
  filterStats: {
    targetsIn: { type: Number, default: 0 },
    eligible: { type: Number, default: 0 },
    excluded: { type: Number, default: 0 },
    selfHits: { type: Number, default: 0 },
    dncHits: { type: Number, default: 0 },
    activeHits: { type: Number, default: 0 },
    pastHits: { type: Number, default: 0 },
    groupHits: { type: Number, default: 0 },
    antiIcpHits: { type: Number, default: 0 },
  },
  scoreStats: {
    accountsScored: { type: Number, default: 0 },
    bucketHot: { type: Number, default: 0 },
    bucketPriority: { type: Number, default: 0 },
    bucketActive: { type: Number, default: 0 },
    bucketNurture: { type: Number, default: 0 },
    bucketExcluded: { type: Number, default: 0 },
    avgScore: { type: Number, default: 0 },
    competitorPenaltyHits: { type: Number, default: 0 },
  },
  stakeholderStats: {
    accountsProcessed: { type: Number, default: 0 },
    accountsWithAny: { type: Number, default: 0 },
    leadsFound: { type: Number, default: 0 },
  },
  emailStats: {
    leadsChecked: { type: Number, default: 0 },
    verified: { type: Number, default: 0 },
    likely: { type: Number, default: 0 },
    unavailable: { type: Number, default: 0 },
    creditsUsed: { type: Number, default: 0 },
  },
  researchStats: {
    accountsResearched: { type: Number, default: 0 },
    tavilyCalls: { type: Number, default: 0 },
    coreSignalCreditsUsed: { type: Number, default: 0 },
    apifyCalls: { type: Number, default: 0 },
    llmTokensIn: { type: Number, default: 0 },
    llmTokensOut: { type: Number, default: 0 },
  },
  validationStats: {
    leadsChecked: { type: Number, default: 0 },
    shippable: { type: Number, default: 0 },
    noEmail: { type: Number, default: 0 },
    shortPrompt: { type: Number, default: 0 },
    vwoIssues: { type: Number, default: 0 },
  },

  // Post-campaign metrics — set later by operator/integration
  postCampaign: {
    emailsSent: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    meetingsBooked: { type: Number, default: 0 },
    meetingsCompleted: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    recordedAt: { type: Date, default: null },
    recordedBy: { type: String, default: "" },
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { strict: false });

OutboundCampaignOutcomeSchema.index({ pilotId: 1, startedAt: -1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, OutboundCampaignOutcomeSchema);
