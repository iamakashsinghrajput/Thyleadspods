import mongoose, { Schema } from "mongoose";

const modelName = "ClientDetail";

const ClientDetailSchema = new Schema({
  projectId: { type: String, required: true, index: true },
  id: { type: String, required: true },
  meetingId: { type: String, default: "" },
  month: { type: String, default: "" },
  year: { type: Number, default: 0 },
  clientName: { type: String, default: "" },
  geo: { type: String, default: "" },
  salesRep: { type: String, default: "" },
  accountManager: { type: String, default: "" },
  meetingDate: { type: String, default: "" },
  meetingTime: { type: String, default: "" },
  meetingStatus: { type: String, enum: ["scheduled", "done", "pipeline"], default: "scheduled" },
  meetingLink: { type: String, default: "" },
  companyName: { type: String, default: "" },
  contactName: { type: String, default: "" },
  contactTitle: { type: String, default: "" },
  contactEmail: { type: String, default: "" },
  contactNumber: { type: String, default: "" },
  remarks: { type: String, default: "" },
  additionalInfo: { type: String, default: "" },
  meetingSummary: { type: String, default: "" },
}, { strict: false, timestamps: true });

ClientDetailSchema.index({ projectId: 1, id: 1 }, { unique: true });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, ClientDetailSchema);
