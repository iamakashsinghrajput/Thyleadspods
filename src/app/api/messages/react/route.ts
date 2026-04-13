import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Message from "@/lib/models/message";

export async function POST(req: NextRequest) {
  await connectDB();
  const { messageId, emoji, userId, userName } = await req.json();

  if (!messageId || !emoji || !userId || !userName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const msg = await Message.findById(messageId);
  if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  if (!msg.reactions) msg.set("reactions", []);

  const existing = msg.reactions.findIndex(
    (r: { emoji?: string | null; userId?: string | null }) => r.emoji === emoji && r.userId === userId
  );

  if (existing >= 0) {
    msg.reactions.splice(existing, 1);
  } else {
    msg.reactions.push({ emoji, userId, userName });
  }

  await msg.save();
  return NextResponse.json({ reactions: msg.reactions });
}
