import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Message from "@/lib/models/message";

export async function POST(req: NextRequest) {
  await connectDB();
  const { messageId, chatId, userId } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (messageId) {
    await Message.findByIdAndUpdate(messageId, { $addToSet: { deletedBy: userId } });
    return NextResponse.json({ ok: true });
  }

  if (chatId) {
    await Message.updateMany({ chatId }, { $addToSet: { deletedBy: userId } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Missing messageId or chatId" }, { status: 400 });
}
