import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import path from "path";
import { connectDB } from "@/lib/mongodb";
import SignatureAsset from "@/lib/models/signature-asset";
import {
  SHINE_W,
  SHINE_H,
  buildShineFramesSmooth,
  buildShineFramesCompact,
  shineFrameSvg,
} from "@/lib/signature-shine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Variant = "webp" | "gif" | "gif-inline";

const KEY: Record<Variant, string> = {
  "webp": "thyleads-shine-webp-v7-inter",
  "gif": "thyleads-shine-gif-v7-inter",
  "gif-inline": "thyleads-shine-gif-inline-v7-inter",
};

interface AssetDoc {
  data: Buffer;
  contentType?: string;
}

const FONTS_DIR = path.join(process.cwd(), "fonts");
const FONT_FILES = [
  path.join(FONTS_DIR, "Inter-Regular.ttf"),
  path.join(FONTS_DIR, "Inter-ExtraBold.ttf"),
];

async function renderRawFrames(smooth: boolean) {
  const frames = smooth ? buildShineFramesSmooth() : buildShineFramesCompact();
  const rawFrames: Buffer[] = [];
  for (const f of frames) {
    const svg = shineFrameSvg(f.reveal, f.shine);
    // resvg-js gives us Skia-grade SVG rasterization with the real Inter typeface
    // instead of librsvg's Helvetica fallback.
    const resvg = new Resvg(svg, {
      background: "white",
      fitTo: { mode: "width", value: SHINE_W },
      font: {
        fontFiles: FONT_FILES,
        loadSystemFonts: false,
        defaultFontFamily: "Inter",
      },
      shapeRendering: 2, // geometricPrecision
      textRendering: 2, // geometricPrecision
      imageRendering: 0, // optimizeQuality
    });
    const pngBuffer = resvg.render().asPng();
    // Hand off to sharp only for pixel-buffer extraction at the canvas size resvg produced.
    const raw = await sharp(pngBuffer)
      .resize(SHINE_W, SHINE_H, { kernel: "lanczos3" })
      .ensureAlpha()
      .raw()
      .toBuffer();
    rawFrames.push(raw);
  }
  return { frames, rawFrames };
}

async function renderAnimatedWebP(): Promise<Buffer> {
  const { frames, rawFrames } = await renderRawFrames(true);
  const combined = Buffer.concat(rawFrames);
  const delays = frames.map((f) => f.delay);
  return sharp(combined, {
    raw: { width: SHINE_W, height: SHINE_H * frames.length, channels: 4 },
    pages: frames.length,
  })
    .webp({ quality: 92, loop: 0, delay: delays, effort: 6, smartSubsample: true })
    .toBuffer();
}

async function renderAnimatedGif(compact: boolean): Promise<Buffer> {
  const { frames, rawFrames } = await renderRawFrames(!compact);
  const combined = Buffer.concat(rawFrames);
  const delays = frames.map((f) => f.delay);
  return sharp(combined, {
    raw: { width: SHINE_W, height: SHINE_H * frames.length, channels: 4 },
    pages: frames.length,
  })
    .gif({
      loop: 0,
      delay: delays,
      colours: compact ? 64 : 256,
      dither: 1.0,
      effort: 7,
    })
    .toBuffer();
}

function resolveVariant(req: NextRequest): Variant {
  const fmt = (req.nextUrl.searchParams.get("format") || "").toLowerCase();
  const compact = req.nextUrl.searchParams.get("inline") === "1";
  if (fmt === "gif") return compact ? "gif-inline" : "gif";
  if (fmt === "webp" || !fmt) return "webp";
  return "webp";
}

export async function GET(req: NextRequest) {
  await connectDB();
  const variant = resolveVariant(req);
  const key = KEY[variant];

  let doc = (await SignatureAsset.findOne({ key }).lean()) as unknown as AssetDoc | null;

  if (!doc || !doc.data) {
    try {
      let bytes: Buffer;
      let contentType: string;
      if (variant === "webp") {
        bytes = await renderAnimatedWebP();
        contentType = "image/webp";
      } else {
        bytes = await renderAnimatedGif(variant === "gif-inline");
        contentType = "image/gif";
      }
      await SignatureAsset.findOneAndUpdate(
        { key },
        { $set: { key, contentType, data: bytes, updatedAt: new Date() } },
        { upsert: true, new: true }
      );
      doc = { data: bytes, contentType };
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
