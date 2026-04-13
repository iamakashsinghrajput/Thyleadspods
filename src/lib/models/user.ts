import mongoose, { Schema } from "mongoose";

const modelName = "User";

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, default: "" },
  role: { type: String, enum: ["superadmin", "admin", "pod", "client"], default: "pod" },
  podId: { type: String, default: "" },
  projectId: { type: String, default: "" },
  approverId: { type: String, default: "" },
  avatarUrl: { type: String, default: "" },
  googleId: { type: String, default: "" },
  calendarRefreshToken: { type: String, default: "" },
  calendarConnected: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { strict: false });

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ googleId: 1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, UserSchema);
