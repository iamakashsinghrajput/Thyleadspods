import mongoose, { Schema } from "mongoose";

const modelName = "InboxMessage";

const InboxMessageSchema = new Schema({
  threadKey: { type: String, required: true, index: true },
  leadId: { type: Number, required: true },
  campaignId: { type: Number, required: true },
  messageId: { type: String, required: true, unique: true },
  time: { type: Date, default: null, index: true },
  type: { type: String, default: "" },
  subject: { type: String, default: "" },
  body: { type: String, default: "" },
  fromEmail: { type: String, default: "" },
  toEmail: { type: String, default: "" },
  openCount: { type: Number, default: 0 },
  clickCount: { type: Number, default: 0 },
  syncedAt: { type: Date, default: Date.now },
}, { strict: false, timestamps: true });

InboxMessageSchema.index({ threadKey: 1, time: 1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, InboxMessageSchema);
