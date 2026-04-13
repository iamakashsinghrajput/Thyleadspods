import mongoose, { Schema } from "mongoose";

const modelName = "Attendance";

const AttendanceSchema = new Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  date: { type: String, required: true },
  punchIn: { type: String, default: null },
  punchOut: { type: String, default: null },
  totalMinutes: { type: Number, default: 0 },
  status: { type: String, enum: ["present", "absent", "half-day", "leave"], default: "present" },
  rePunchIn: { type: Boolean, default: false },
  rePunchLog: { type: String, default: "" },
  prevMinutes: { type: Number, default: 0 },
  rePunchCount: { type: Number, default: 0 },
  isLeave: { type: Boolean, default: false },
  isWfh: { type: Boolean, default: false },
}, { strict: false });

AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, AttendanceSchema);
