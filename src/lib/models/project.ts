import mongoose, { Schema } from "mongoose";

const modelName = "Project";

const ProjectSchema = new Schema({
  id: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  clientName: { type: String, required: true },
  assignedPod: { type: String, required: true },
  monthlyTargetExternal: { type: Number, default: 0 },
  weeklyTargetExternal: { type: Number, default: 0 },
  monthlyTargetInternal: { type: Number, default: 0 },
  targetsAchieved: { type: Number, default: 0 },
  meetingCompleted: { type: Number, default: 0 },
  meetingBooked: { type: Number, default: 0 },
}, { strict: false, timestamps: true });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, ProjectSchema);
