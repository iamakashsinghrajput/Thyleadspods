import mongoose, { Schema } from "mongoose";

const modelName = "InboxThread";

const InboxThreadSchema = new Schema({
  threadKey: { type: String, required: true, unique: true },
  leadId: { type: Number, required: true, index: true },
  campaignId: { type: Number, required: true, index: true },
  campaignName: { type: String, default: "" },
  campaignStatus: { type: String, default: "" },
  leadFirstName: { type: String, default: "" },
  leadLastName: { type: String, default: "" },
  leadEmail: { type: String, default: "", index: true },
  leadCompany: { type: String, default: "" },
  leadTitle: { type: String, default: "" },
  leadPhone: { type: String, default: "" },
  leadStatus: { type: String, default: "" },
  category: { type: String, default: "" },
  replyCount: { type: Number, default: 0 },
  lastReplyAt: { type: Date, default: null, index: true },
  lastReplyPreview: { type: String, default: "" },
  lastReplySubject: { type: String, default: "" },
  locallyReadAt: { type: Date, default: null },
  syncedAt: { type: Date, default: Date.now },
  messageHistorySyncedAt: { type: Date, default: null },
  categorySyncedAt: { type: Date, default: null },
}, { strict: false, timestamps: true });

InboxThreadSchema.index({ lastReplyAt: -1 });
InboxThreadSchema.index({ campaignId: 1, lastReplyAt: -1 });
InboxThreadSchema.index({ category: 1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, InboxThreadSchema);
