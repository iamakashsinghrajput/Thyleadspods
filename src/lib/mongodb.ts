import mongoose from "mongoose";

const cached = (global as unknown as { mongoose?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } }).mongoose ?? { conn: null, promise: null };
(global as unknown as { mongoose: typeof cached }).mongoose = cached;

export async function connectDB() {
  if (cached.conn) return cached.conn;
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
