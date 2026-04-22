import mongoose, { Schema } from "mongoose";

const modelName = "Notification";

const NotificationSchema = new Schema({
  forRole: { type: String, enum: ["admin", "pod", "superadmin"], required: true },
  forPodId: { type: String, default: "" },
  forUserEmail: { type: String, default: "" },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  readBy: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now, index: true },
}, { strict: false });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, NotificationSchema);
