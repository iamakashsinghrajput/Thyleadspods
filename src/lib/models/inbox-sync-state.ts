import mongoose, { Schema } from "mongoose";

const modelName = "InboxSyncState";

const InboxSyncStateSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "global" },
  lastSyncedAt: { type: Date, default: null },
  lastSyncedCampaignCount: { type: Number, default: 0 },
  lastSyncedThreadCount: { type: Number, default: 0 },
  syncingAt: { type: Date, default: null },
  heartbeatAt: { type: Date, default: null },
  cancelRequested: { type: Boolean, default: false },
  progress: {
    type: new Schema({
      stage: { type: String, default: "" },
      campaignsTotal: { type: Number, default: 0 },
      campaignsProcessed: { type: Number, default: 0 },
      currentCampaign: { type: String, default: "" },
      leadsScanned: { type: Number, default: 0 },
      threadsPersisted: { type: Number, default: 0 },
    }, { _id: false }),
    default: {},
  },
  lastError: { type: String, default: "" },
}, { strict: false, timestamps: true });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, InboxSyncStateSchema);
