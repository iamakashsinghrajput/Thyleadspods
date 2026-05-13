import mongoose, { Schema } from "mongoose";

const modelName = "SmartleadCache";

const SmartleadCacheSchema = new Schema({
  path: { type: String, required: true, unique: true },
  data: { type: Schema.Types.Mixed },
  fetchedAt: { type: Date, default: Date.now },
  refreshingAt: { type: Date, default: null },
}, { strict: false, timestamps: true });

// Auto-evict cache entries after 24h to keep storage bounded.
SmartleadCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, SmartleadCacheSchema);
