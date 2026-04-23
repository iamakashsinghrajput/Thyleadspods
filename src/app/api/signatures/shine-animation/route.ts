import { NextResponse } from "next/server";
import sharp from "sharp";
import { connectDB } from "@/lib/mongodb";
import SignatureAsset from "@/lib/models/signature-asset";
import { SHINE_W, SHINE_H, buildShineFramesSmooth, shineFrameSvg } from "@/lib/signature-shine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEY = "thyleads-shine-webp-v5";

interface AssetDoc {
  data: Buffer;
  contentType?: string;
}

async function renderAnimatedWebP(): Promise<Buffer> {
  const frames = buildShineFramesSmooth();

  // Rasterize each SVG frame to raw RGBA at the exact output size.
  const rawFrames: Buffer[] = [];
  for (const f of frames) {
    const svg = shineFrameSvg(f.reveal, f.shine);
    const raw = await sharp(Buffer.from(svg))
      .resize(SHINE_W, SHINE_H)
      .ensureAlpha()
      .raw()
      .toBuffer();
    rawFrames.push(raw);
  }

  // Concatenate frames and tell sharp to treat the input as multi-page raw pixels.
  const combined = Buffer.concat(rawFrames);
  const delays = frames.map((f) => f.delay);

  const webp = await sharp(combined, {
    raw: { width: SHINE_W, height: SHINE_H * frames.length, channels: 4 },
    pages: frames.length,
  })
    .webp({ quality: 85, loop: 0, delay: delays, effort: 4 })
    .toBuffer();

  return webp;
}

export async function GET() {
  await connectDB();
  let doc = (await SignatureAsset.findOne({ key: KEY }).lean()) as unknown as AssetDoc | null;

  if (!doc || !doc.data) {
    try {
      const webp = await renderAnimatedWebP();
      await SignatureAsset.findOneAndUpdate(
        { key: KEY },
        { $set: { key: KEY, contentType: "image/webp", data: webp, updatedAt: new Date() } },
        { upsert: true, new: true }
      );
      doc = { data: webp, contentType: "image/webp" };
    } catch {
      return new NextResponse("Failed to render", { status: 500 });
    }
  }

  return new NextResponse(Uint8Array.from(doc.data), {
    status: 200,
    headers: {
      "Content-Type": doc.contentType || "image/webp",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
