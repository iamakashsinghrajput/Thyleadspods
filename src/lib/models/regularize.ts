import mongoose, { Schema } from "mongoose";

const modelName = "Regularize";

const RegularizeSchema = new Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  date: { type: String, required: true },
  punchIn: { type: String, required: true },
  punchOut: { type: String, required: true },
  reason: { type: String, required: true },
  approverId: { type: String, default: "" },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  adminNote: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
}, { strict: false });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, RegularizeSchema);
