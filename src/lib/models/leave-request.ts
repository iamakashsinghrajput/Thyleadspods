import mongoose, { Schema } from "mongoose";

const modelName = "LeaveRequest";

const LeaveRequestSchema = new Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  leaveDate: { type: String, required: true },
  leaveType: { type: String, required: true, enum: [
    "Sick Leave",
    "Casual Leave",
    "Earned Leave",
    "Personal Leave",
    "Family Emergency",
    "Medical Appointment",
    "Bereavement Leave",
    "Other",
  ]},
  subject: { type: String, required: true },
  body: { type: String, required: true },
  approverId: { type: String, required: true },
  status: { type: String, enum: ["pending", "approved", "denied"], default: "pending" },
  adminNote: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
}, { strict: false });

LeaveRequestSchema.index({ userId: 1, leaveDate: 1 });
LeaveRequestSchema.index({ approverId: 1, status: 1 });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, LeaveRequestSchema);
