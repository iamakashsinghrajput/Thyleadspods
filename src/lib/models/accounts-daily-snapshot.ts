import mongoose, { Schema } from "mongoose";

const modelName = "AccountsDailySnapshot";

const SnapshotSchema = new Schema({
  projectId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  totalRows: { type: Number, default: 0 },
  uniqueDomains: { type: Number, default: 0 },
  newRows: { type: Number, default: 0 },
  newDomains: { type: Number, default: 0 },
  newDomainsList: { type: [String], default: [] },
  newRowsList: { type: [String], default: [] },
  allDomains: { type: [String], default: [] },
  allRows: { type: [String], default: [] },
  recordedAt: { type: Date, default: Date.now },
}, { strict: false, timestamps: true });

SnapshotSchema.index({ projectId: 1, date: 1 }, { unique: true });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, SnapshotSchema);
