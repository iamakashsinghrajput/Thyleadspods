import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Message from "@/lib/models/message";

export async function POST(req: NextRequest) {
  await connectDB();
  const { messageId, chatId } = await req.json();

  if (messageId) {
    await Message.findByIdAndDelete(messageId);
    return NextResponse.json({ ok: true });
  }

  if (chatId) {
    await Message.deleteMany({ chatId });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Missing messageId or chatId" }, { status: 400 });
}
