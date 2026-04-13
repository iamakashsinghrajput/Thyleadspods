import mongoose, { Schema } from "mongoose";

const modelName = "Presence";

const PresenceSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  userName: { type: String, required: true },
  lastSeen: { type: Date, default: Date.now },
}, { strict: false });

PresenceSchema.index({ userId: 1 }, { unique: true });
PresenceSchema.index({ lastSeen: 1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, PresenceSchema);
