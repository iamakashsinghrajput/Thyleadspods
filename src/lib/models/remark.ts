import mongoose, { Schema } from "mongoose";

const modelName = "Remark";

const RemarkSchema = new Schema({
  projectId: { type: String, required: true },
  meetingId: { type: String, required: true },
  remark: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, default: "" },
}, { strict: false });

RemarkSchema.index({ projectId: 1, meetingId: 1 }, { unique: true });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, RemarkSchema);
