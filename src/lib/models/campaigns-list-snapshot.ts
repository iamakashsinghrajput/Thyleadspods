import mongoose, { Schema } from "mongoose";

const modelName = "CampaignsListSnapshot";

const CampaignRowSchema = new Schema({
  id: { type: Number, required: true },
  name: { type: String, default: "" },
  status: { type: String, default: "" },
  createdAt: { type: String, default: null },
  sentCount: { type: Number, default: 0 },
  openCount: { type: Number, default: 0 },
  clickCount: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  bounceCount: { type: Number, default: 0 },
  unsubscribedCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  uniqueOpenCount: { type: Number, default: 0 },
  uniqueClickCount: { type: Number, default: 0 },
}, { _id: false });

const SnapshotSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "global" },
  campaigns: { type: [CampaignRowSchema], default: [] },
  counts: { type: Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: null },
  refreshingAt: { type: Date, default: null },
  lastError: { type: String, default: "" },
}, { strict: false, timestamps: true });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, SnapshotSchema);
