import mongoose, { Schema } from "mongoose";

const modelName = "ClientMetric";

const DailyMetricSchema = new Schema({
  date: { type: String, required: true },
  leadsUploaded: { type: Number, default: 0 },
  accountsMined: { type: Number, default: 0 },
}, { _id: false });

const ClientMetricSchema = new Schema({
  projectId: { type: String, required: true, index: true },
  clientId: { type: String, required: true },
  month: { type: String, required: true },
  year: { type: Number, required: true },
  dailyMetrics: { type: [DailyMetricSchema], default: [] },
}, { strict: false, timestamps: true });

ClientMetricSchema.index({ projectId: 1, month: 1, year: 1 }, { unique: true });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, ClientMetricSchema);
