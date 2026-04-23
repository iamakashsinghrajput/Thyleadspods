import mongoose, { Schema } from "mongoose";

const modelName = "SignatureAsset";

const SignatureAssetSchema = new Schema({
  key: { type: String, required: true, unique: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
  updatedAt: { type: Date, default: Date.now },
}, { strict: false });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, SignatureAssetSchema);
