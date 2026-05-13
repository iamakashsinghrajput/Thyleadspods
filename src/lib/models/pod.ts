import mongoose, { Schema } from "mongoose";

const modelName = "Pod";

const PodSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  members: { type: [String], default: [] },
  color: { type: String, default: "" },
  text: { type: String, default: "" },
  bgLight: { type: String, default: "" },
  order: { type: Number, default: 0 },
}, { strict: false, timestamps: true });

PodSchema.index({ id: 1 }, { unique: true });
PodSchema.index({ order: 1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, PodSchema);
