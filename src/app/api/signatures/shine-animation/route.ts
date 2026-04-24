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
// Rendering 60 animated frames on a cold Vercel function can take 10-20s.
// The Hobby cap is 60s; Pro is higher. Set explicit budget so we don't get killed.
export const maxDuration = 60;

type Variant = "webp" | "gif" | "gif-inline";

const KEY: Record<Variant, string> = {
  "webp": "thyleads-shine-webp-v10",
  "gif": "thyleads-shine-gif-v10",
  "gif-inline": "thyleads-shine-gif-inline-v10",
};

interface AssetDoc {
  data: Buffer;
  contentType?: string;
}

const FONT_CANDIDATE_DIRS = [
  // Local dev / Vercel's repo root preserved via output file tracing.
  path.join(process.cwd(), "fonts"),
  // Some Vercel build layouts place traced assets under the function bundle.
  path.join(process.cwd(), ".next", "server", "fonts"),
  path.join(process.cwd(), ".next", "standalone", "fonts"),
  path.join("/var/task", "fonts"),
];

async function resolveFontFiles(): Promise<string[]> {
  const { access } = await import("fs/promises");
  const filenames = ["Inter-Regular.ttf", "Inter-ExtraBold.ttf"];
  for (const dir of FONT_CANDIDATE_DIRS) {
    try {
      const found: string[] = [];
      for (const f of filenames) {
        const full = path.join(dir, f);
        await access(full);
        found.push(full);
      }
      if (found.length === filenames.length) return found;
    } catch {}
  }
  return [];
}

async function renderRawFrames(smooth: boolean) {
  const frames = smooth ? buildShineFramesSmooth() : buildShineFramesCompact();
  const fontFiles = await resolveFontFiles();
  const rawFrames: Buffer[] = [];
  for (const f of frames) {
    const svg = shineFrameSvg(f.reveal, f.shine);
    const resvg = new Resvg(svg, {
      background: "white",
      fitTo: { mode: "width", value: SHINE_W },
      font: fontFiles.length > 0
        ? { fontFiles, loadSystemFonts: false, defaultFontFamily: "Inter" }
        : { loadSystemFonts: true, defaultFontFamily: "Inter" },
      shapeRendering: 2,
      textRendering: 2,
      imageRendering: 0,
    });
    const pngBuffer = resvg.render().asPng();
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
    raw: { width: SHINE_W, height: SHINE_H * frames.length, channels: 4, pageHeight: SHINE_H },
  })
    .webp({ quality: 92, loop: 0, delay: delays, effort: 4, smartSubsample: true })
    .toBuffer();
}

async function renderAnimatedGif(compact: boolean): Promise<Buffer> {
  const { frames, rawFrames } = await renderRawFrames(!compact);
  const combined = Buffer.concat(rawFrames);
  const delays = frames.map((f) => f.delay);
  return sharp(combined, {
    raw: { width: SHINE_W, height: SHINE_H * frames.length, channels: 4, pageHeight: SHINE_H },
  })
    .gif({
      loop: 0,
      delay: delays,
      colours: compact ? 64 : 256,
      dither: 1.0,
      effort: 4,
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

function debugRequested(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get("debug") === "1";
}

export async function GET(req: NextRequest) {
  const variant = resolveVariant(req);
  const key = KEY[variant];
  const debug = debugRequested(req);

  // --- 1. Try Mongo cache (best-effort; don't fail render if DB is unreachable) ----
  let doc: AssetDoc | null = null;
  try {
    await connectDB();
    doc = (await SignatureAsset.findOne({ key }).lean()) as unknown as AssetDoc | null;
  } catch (e) {
    if (debug) {
      return NextResponse.json({ stage: "mongo-read", error: String(e) }, { status: 500 });
    }
    // Continue — we'll render fresh below.
  }

  // --- 2. Render if nothing cached --------------------------------------------------
  if (!doc || !doc.data) {
    try {
      const bytes = variant === "webp"
        ? await renderAnimatedWebP()
        : await renderAnimatedGif(variant === "gif-inline");
      const contentType = variant === "webp" ? "image/webp" : "image/gif";
      doc = { data: bytes, contentType };

      // Best-effort cache write — if it fails we still have `bytes` ready to serve.
      try {
        await connectDB();
        await SignatureAsset.findOneAndUpdate(
          { key },
          { $set: { key, contentType, data: bytes, updatedAt: new Date() } },
          { upsert: true, new: true }
        );
      } catch {}
    } catch (e) {
      if (debug) {
        return NextResponse.json({
          stage: "render",
          variant,
          cwd: process.cwd(),
          error: String(e),
          stack: e instanceof Error ? e.stack : undefined,
        }, { status: 500 });
      }
      return new NextResponse(`Failed to render: ${e instanceof Error ? e.message : "unknown"}`, { status: 500 });
    }
  }

  // --- 3. Serve bytes ---------------------------------------------------------------
  return new NextResponse(Uint8Array.from(doc.data), {
    status: 200,
    headers: {
      "Content-Type": doc.contentType || "image/webp",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
