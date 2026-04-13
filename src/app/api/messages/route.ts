import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Message from "@/lib/models/message";

export async function GET(req: NextRequest) {
  await connectDB();
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ messages: [] });

  const after = req.nextUrl.searchParams.get("after");
  const query: Record<string, unknown> = { chatId };
  if (after) query.createdAt = { $gt: new Date(after) };

  const raw = await Message.find(query).sort({ createdAt: 1 }).limit(200).lean();
  const messages = raw.map((m) => ({
    _id: String(m._id),
    chatId: m.chatId,
    sender: m.sender,
    senderName: m.senderName,
    text: m.text,
    replyInfo: m.replyInfo || null,
    reactions: m.reactions || [],
    createdAt: m.createdAt,
  }));
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const { chatId, sender, senderName, text, replyInfo } = await req.json();

  if (!chatId || !sender || !senderName || !text) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const doc = await Message.create({
    chatId,
    sender,
    senderName,
    text,
    replyInfo: replyInfo || null,
    reactions: [],
  });

  return NextResponse.json({
    message: {
      _id: String(doc._id),
      chatId: doc.chatId,
      sender: doc.sender,
      senderName: doc.senderName,
      text: doc.text,
      replyInfo: doc.replyInfo || null,
      reactions: doc.reactions || [],
      createdAt: doc.createdAt,
    }
  }, { status: 201 });
}
