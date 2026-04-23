import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import SignatureAsset from "@/lib/models/signature-asset";

const KEY = "flip-animation";

interface AssetDoc {
  data: Buffer;
  contentType?: string;
}

export async function GET() {
  await connectDB();
  const doc = (await SignatureAsset.findOne({ key: KEY }).lean()) as unknown as AssetDoc | null;
  if (!doc || !doc.data) {
    return new NextResponse("Not generated yet", { status: 404 });
  }
  const bodyBytes = Uint8Array.from(doc.data);
  return new NextResponse(bodyBytes, {
    status: 200,
    headers: {
      "Content-Type": doc.contentType || "image/gif",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const dataUri: string = body.dataUri || "";
  const m = dataUri.match(/^data:(image\/[a-z+.-]+);base64,(.*)$/i);
  if (!m) return NextResponse.json({ error: "Invalid dataUri" }, { status: 400 });
  const contentType = m[1];
  const buffer = Buffer.from(m[2], "base64");
  await SignatureAsset.findOneAndUpdate(
    { key: KEY },
    { $set: { key: KEY, contentType, data: buffer, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
  return NextResponse.json({ ok: true, size: buffer.length });
}
