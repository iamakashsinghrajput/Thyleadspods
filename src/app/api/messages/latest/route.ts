import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Message from "@/lib/models/message";

export async function GET(req: NextRequest) {
  await connectDB();
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ conversations: {} });

  const messages = await Message.find({
    chatId: { $regex: userId },
  }).sort({ createdAt: -1 }).lean();

  const conversations: Record<string, { text: string; senderName: string; sender: string; createdAt: string }> = {};

  for (const msg of messages) {
    const parts = msg.chatId.split("_");
    const otherId = parts.find((p: string) => p !== userId) || parts[0];
    if (!conversations[otherId]) {
      conversations[otherId] = {
        text: msg.text,
        senderName: msg.senderName,
        sender: msg.sender,
        createdAt: msg.createdAt.toISOString(),
      };
    }
  }

  return NextResponse.json({ conversations });
}
