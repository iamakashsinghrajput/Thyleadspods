import mongoose, { Schema } from "mongoose";

const MessageSchema = new Schema({
  chatId: { type: String, required: true, index: true },
  sender: { type: String, required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  replyInfo: {
    type: {
      messageId: String,
      senderName: String,
      text: String,
    },
    default: null,
  },
  reactions: {
    type: [{
      emoji: String,
      userId: String,
      userName: String,
    }],
    default: [],
  },
  createdAt: { type: Date, default: Date.now },
}, { strict: false });

const modelName = "Message";
if (mongoose.models[modelName]) {
  delete mongoose.models[modelName];
}
const schemas = mongoose as unknown as { modelSchemas?: Record<string, unknown> };
if (schemas.modelSchemas?.[modelName]) {
  delete schemas.modelSchemas[modelName];
}

export default mongoose.model(modelName, MessageSchema);
