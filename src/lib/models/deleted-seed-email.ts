import mongoose, { Schema } from "mongoose";

const modelName = "DeletedSeedEmail";

const DeletedSeedEmailSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  deletedAt: { type: Date, default: Date.now },
  deletedBy: { type: String, default: "" },
}, { strict: false });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, DeletedSeedEmailSchema);
