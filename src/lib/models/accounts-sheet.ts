import mongoose, { Schema } from "mongoose";

const modelName = "AccountsSheet";

const AccountRowSchema = new Schema({
  domain: { type: String, required: true },
  company: { type: String, default: "" },
  dnc: { type: Boolean, default: false },
  rootKey: { type: String, default: "" },
}, { _id: false });

const SheetSchema = new Schema({
  projectId: { type: String, required: true, unique: true },
  rows: { type: [AccountRowSchema], default: [] },
  totals: {
    uploaded: { type: Number, default: 0 },
    dnc: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    uniqueDomains: { type: Number, default: 0 },
  },
  manualDnc: { type: [String], default: [] },
  manualDncUpdatedAt: { type: Date, default: null },
  manualDncUpdatedBy: { type: String, default: "" },
  originalFileName: { type: String, default: "" },
  uploadedBy: { type: String, default: "" },
  source: { type: String, default: "upload" },
  googleSheet: {
    sheetUrl: { type: String, default: "" },
    spreadsheetId: { type: String, default: "" },
    tabTitle: { type: String, default: "" },
    tabSheetId: { type: Number, default: null },
    connectedAt: { type: Date, default: null },
    connectedBy: { type: String, default: "" },
    lastSyncAt: { type: Date, default: null },
    lastSyncError: { type: String, default: "" },
    domainColumn: { type: String, default: "" },
    companyColumn: { type: String, default: "" },
  },
  updatedAt: { type: Date, default: null },
}, { strict: false, timestamps: true });

if (mongoose.models[modelName]) delete mongoose.models[modelName];
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) delete schemas.modelSchemas[modelName];

export default mongoose.model(modelName, SheetSchema);
