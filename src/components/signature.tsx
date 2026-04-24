"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Share2, Trash2, Copy, Check, X, Pencil, Download } from "lucide-react";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { useAuth } from "@/lib/auth-context";
import { usePods } from "@/lib/pod-context";
import { SEED_USERS } from "@/lib/seed-users";
import { SHINE_W, SHINE_H, buildShineFramesCompact, shineFrameSvg } from "@/lib/signature-shine";

const LOGO_PNG_SIZE = 22;
const SHINE_GIF_W = SHINE_W;
const SHINE_GIF_H = SHINE_H;
// Bump when the server render changes. This version becomes part of the URL so Gmail's
// image proxy (which caches external image responses aggressively) treats every version
// as a brand-new resource instead of serving a stale cached copy.
const SHINE_ASSET_VERSION = 15;
const SHINE_ASSET_BASE = "/api/signatures/shine-animation";
const SHINE_ASSET_PATH = `${SHINE_ASSET_BASE}?v=${SHINE_ASSET_VERSION}`;
let cachedLogoPng: string | null = null;
let cachedShineGif: string | null = null;

async function fetchInlineShineDataUri(): Promise<string | undefined> {
  if (cachedShineGif) return cachedShineGif;
  // Prefer the sharp-rendered server GIF (dithered, with real Inter) — but if the server
  // route is unreachable / returns an error / returns too-large bytes, fall back to the
  // client-side gifenc encoder which is guaranteed to produce a Gmail-safe GIF.
  try {
    const res = await fetch(`${SHINE_ASSET_BASE}?format=gif&inline=1&v=${SHINE_ASSET_VERSION}`, { cache: "force-cache" });
    if (!res.ok) throw new Error(`server render failed: ${res.status}`);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length > 8 * 1024) throw new Error("too large to inline");
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    cachedShineGif = `data:image/gif;base64,${btoa(binary)}`;
    return cachedShineGif;
  } catch {
    return buildShineGifDataUri().catch(() => undefined);
  }
}

function isPublicOrigin(origin: string): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (/^10\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

// On a publicly-reachable origin we reference the hosted URL directly — Gmail's image
// proxy fetches it, signature HTML stays tiny, animation quality is the full-res WebP.
// On localhost / private networks we embed the GIF inline (Gmail's proxy can't reach localhost).
async function resolveShineSrc(): Promise<string | undefined> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (isPublicOrigin(origin)) {
    return `${origin}${SHINE_ASSET_PATH}`;
  }
  return fetchInlineShineDataUri();
}

async function rasterizeSvgToImageData(svg: string, w: number, h: number): Promise<Uint8ClampedArray> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d ctx");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function buildShineGifDataUri(): Promise<string> {
  if (cachedShineGif) return cachedShineGif;
  const W = SHINE_GIF_W;
  const H = SHINE_GIF_H;

  const frames = buildShineFramesCompact();
  const raster = await Promise.all(frames.map((f) => rasterizeSvgToImageData(shineFrameSvg(f.reveal, f.shine), W, H)));

  const combinedLen = raster.reduce((a, r) => a + r.length, 0);
  const combined = new Uint8ClampedArray(combinedLen);
  let offset = 0;
  for (const r of raster) {
    combined.set(r, offset);
    offset += r.length;
  }
  const globalPalette = quantize(combined, 32, { format: "rgb444" });

  const encoder = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    const indexed = applyPalette(raster[i], globalPalette, "rgb444");
    encoder.writeFrame(indexed, W, H, {
      palette: i === 0 ? globalPalette : undefined,
      first: i === 0,
      delay: frames[i].delay,
      dispose: 1,
      repeat: i === 0 ? 0 : undefined,
    });
  }
  encoder.finish();

  const bytes = encoder.bytes();
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  cachedShineGif = `data:image/gif;base64,${btoa(binary)}`;
  return cachedShineGif;
}

async function buildLogoPngDataUri(): Promise<string> {
  if (cachedLogoPng) return cachedLogoPng;
  const size = LOGO_PNG_SIZE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 78 78"><path d="M33.54 78V20.0792H12.48V10.8119H67.86V27.0297H78V0H0V30.8911H21.84V78H33.54Z" fill="#6800FF"/><path d="M55.38 20.0792H43.68V78H78V68.7327H55.38V20.0792Z" fill="#6800FF"/></svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logo svg load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d ctx");
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    cachedLogoPng = canvas.toDataURL("image/png");
    return cachedLogoPng;
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface SignatureDoc {
  id: string;
  name: string;
  personName: string;
  position: string;
  phone: string;
  linkedInUrl: string;
  websiteUrl: string;
  createdBy: string;
  sharedWithRoles: string[];
  sharedWithPodIds: string[];
  sharedWithEmails: string[];
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  id: string | null;
  name: string;
  personName: string;
  position: string;
  phone: string;
  linkedInUrl: string;
  websiteUrl: string;
}

const BLANK_FORM: FormState = {
  id: null,
  name: "",
  personName: "",
  position: "",
  phone: "",
  linkedInUrl: "",
  websiteUrl: "",
};

const BRAND_STYLES = `
@keyframes thy-text-in {
  0%   { clip-path: inset(0 100% 0 0); -webkit-clip-path: inset(0 100% 0 0); filter: blur(4px); }
  85%  { filter: blur(0.6px); }
  100% { clip-path: inset(0 0 0 0);    -webkit-clip-path: inset(0 0 0 0); filter: blur(0); }
}
@keyframes thy-text-shine {
  0%   { background-position: 170% 0; }
  35%  { background-position: -70% 0; }
  100% { background-position: -70% 0; }
}
.thy-brand-text {
  display: inline-block;
  clip-path: inset(0 100% 0 0);
  -webkit-clip-path: inset(0 100% 0 0);
  filter: blur(4px);
  background-image: linear-gradient(100deg, #0f172a 0%, #0f172a 38%, #b48bff 47%, #ffffff 50%, #b48bff 53%, #0f172a 62%, #0f172a 100%);
  background-size: 230% 100%;
  background-position: 170% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation:
    thy-text-in 1.6s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards,
    thy-text-shine 6s ease-in-out 1.9s infinite;
}
`;

function ThyMarkSvg({ className = "", fill = "#ffffff" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 78 78" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M33.54 78V20.0792H12.48V10.8119H67.86V27.0297H78V0H0V30.8911H21.84V78H33.54Z" fill={fill} />
      <path d="M55.38 20.0792H43.68V78H78V68.7327H55.38V20.0792Z" fill={fill} />
    </svg>
  );
}

function BrandLogo() {
  return (
    <div className="shrink-0 flex items-center justify-start gap-1 sm:gap-2">
      <ThyMarkSvg className="w-[17px] h-[17px] sm:w-7 sm:h-7 shrink-0" fill="#6800FF" />
      <span className="text-slate-300 text-sm sm:text-2xl font-light leading-none select-none">|</span>
      <span className="thy-brand-text text-[13px] sm:text-[22px] font-extrabold tracking-[0.01em] leading-none">Thyleads</span>
    </div>
  );
}

function renderSignatureHtml(sig: SignatureDoc, logoSrc?: string, _shineSrc?: string): string {
  void _shineSrc;
  const linkedIn = sig.linkedInUrl
    ? `<a href="${sig.linkedInUrl}" style="color:#0f172a;text-decoration:underline;font-weight:600;white-space:nowrap;">Linkedin</a>`
    : "";
  const website = sig.websiteUrl
    ? `<a href="${sig.websiteUrl}" style="color:#0f172a;text-decoration:underline;font-weight:600;word-break:break-all;">${sig.websiteUrl.replace(/^https?:\/\//, "")}</a>`
    : "";
  const sep = linkedIn && website ? `<span style="color:#d1d5db;margin:0 8px;">|</span>` : "";
  const thyleadsCell = `<span style="color:#0f172a;font-family:Inter,Arial,sans-serif;font-size:16px;font-weight:800;letter-spacing:0.2px;line-height:1;white-space:nowrap;">Thyleads</span>`;
  const logoCell = logoSrc
    ? `<img src="${logoSrc}" alt="Thyleads logo" width="${LOGO_PNG_SIZE}" height="${LOGO_PNG_SIZE}" style="display:block;border:0;outline:none;"/>`
    : `<div style="width:${LOGO_PNG_SIZE}px;height:${LOGO_PNG_SIZE}px;background:#6800FF;border-radius:5px;"></div>`;
  const brandBlock = `<table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;"><tr><td style="vertical-align:middle;padding:0 6px 0 0;">${logoCell}</td><td style="vertical-align:middle;color:#cbd5e1;font-size:16px;font-weight:200;padding:0 6px 0 0;line-height:1;">|</td><td style="vertical-align:middle;">${thyleadsCell}</td></tr></table>`;
  return `
<table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;font-family:Inter,Arial,sans-serif;color:#111827;max-width:380px;">
  <tr>
    <td style="vertical-align:middle;padding:2px 10px 2px 0;border-right:1px solid #e2e8f0;">
      ${brandBlock}
    </td>
    <td style="vertical-align:middle;padding:2px 0 2px 10px;">
      <div style="font-size:15px;font-weight:700;color:#6800FF;line-height:1.15;">${sig.personName}</div>
      <div style="font-size:11px;font-weight:600;color:#111827;margin-top:3px;line-height:1.3;">${sig.position}</div>
      <div style="margin-top:5px;color:#6b7280;font-size:10px;line-height:1.4;">${sig.phone}</div>
      <div style="margin-top:4px;font-size:10px;line-height:1.4;">${linkedIn}${sep}${website}</div>
    </td>
  </tr>
</table>`.trim();
}

function SignatureCard({ sig }: { sig: SignatureDoc }) {
  return (
    <div className="bg-transparent px-2 py-1.5 sm:px-6 sm:py-5 rounded-lg sm:rounded-2xl border border-slate-200/60 font-[Inter,sans-serif] w-full max-w-[300px] sm:max-w-xl">
      <div className="flex items-center gap-1.5 sm:gap-5 w-full">
        <BrandLogo />

        <div className="w-px self-stretch bg-slate-200" aria-hidden />

        <div className="flex flex-col min-w-0 flex-1 text-left">
          <h1 className="text-[13px] sm:text-[22px] font-bold text-[#6800FF] leading-tight truncate">{sig.personName || "Full name"}</h1>
          {sig.position && <h2 className="text-[9px] sm:text-[15px] font-semibold text-slate-800 mt-0.5 sm:mt-1 truncate leading-tight">{sig.position}</h2>}
          {sig.phone && <p className="text-[9px] sm:text-[13px] text-slate-500 mt-0.5 sm:mt-2 tracking-wide">{sig.phone}</p>}
          {(sig.linkedInUrl || sig.websiteUrl) && (
            <div className="mt-0.5 sm:mt-1.5 text-[9px] sm:text-[13px] font-semibold flex flex-wrap gap-x-1 sm:gap-x-1.5 justify-start">
              {sig.linkedInUrl && (
                <a href={sig.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-slate-900 hover:text-[#6800FF] transition-colors underline decoration-1 underline-offset-2">
                  Linkedin
                </a>
              )}
              {sig.linkedInUrl && sig.websiteUrl && <span className="text-slate-300">|</span>}
              {sig.websiteUrl && (
                <a href={sig.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-slate-900 hover:text-[#6800FF] transition-colors underline decoration-1 underline-offset-2 break-all">
                  {sig.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Signature() {
  const { user } = useAuth();
  const { pods } = usePods();

  const isSuperadmin = user?.role === "superadmin";
  const isShareRecipient = user?.role === "admin" || user?.role === "pod";

  const [signatures, setSignatures] = useState<SignatureDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [showForm, setShowForm] = useState(false);
  const [shareTargetId, setShareTargetId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [shareRoles, setShareRoles] = useState<string[]>([]);
  const [sharePodIds, setSharePodIds] = useState<string[]>([]);
  const [shareEmails, setShareEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState("");

  const availableTargets = useMemo(
    () => SEED_USERS.filter((u) => u.role === "admin" || u.role === "pod"),
    []
  );

  const fetchSignatures = useCallback(async () => {
    if (!user) return;
    const params = new URLSearchParams({
      role: user.role,
      email: user.email,
      podId: user.podId || "",
    });
    try {
      const res = await fetch(`/api/signatures?${params.toString()}`);
      const data = await res.json();
      setSignatures((data.signatures || []) as SignatureDoc[]);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchSignatures();
  }, [user, fetchSignatures]);

  useEffect(() => {
    if (!user) return;
    // Prebuild the logo PNG so Copy is instant.
    void buildLogoPngDataUri().catch(() => {});
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (isPublicOrigin(origin)) {
      // Warm the hosted WebP so Gmail's first fetch through its image proxy is fast.
      void fetch(`${origin}${SHINE_ASSET_PATH}`, { method: "GET", cache: "no-store" }).catch(() => {});
    } else {
      // On localhost, pre-fetch the compact GIF and cache its base64 data URI.
      void fetchInlineShineDataUri().catch(() => {});
    }
  }, [user]);

  if (!user) return null;
  if (!isSuperadmin && !isShareRecipient) return null;

  async function handleSave() {
    if (!user) return;
    if (!form.name.trim() || !form.personName.trim()) return;
    setLoading(true);
    try {
      const payload = {
        actorRole: user.role,
        name: form.name.trim(),
        personName: form.personName.trim(),
        position: form.position.trim(),
        phone: form.phone.trim(),
        linkedInUrl: form.linkedInUrl.trim(),
        websiteUrl: form.websiteUrl.trim(),
      };
      if (form.id) {
        await fetch("/api/signatures", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: form.id, data: payload }),
        });
      } else {
        await fetch("/api/signatures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, createdBy: user.email }),
        });
      }
      await fetchSignatures();
      setForm(BLANK_FORM);
      setShowForm(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!user) return;
    if (!confirm("Delete this signature?")) return;
    await fetch(`/api/signatures?id=${encodeURIComponent(id)}&actorRole=${user.role}`, {
      method: "DELETE",
    });
    await fetchSignatures();
  }

  function startEdit(sig: SignatureDoc) {
    setForm({
      id: sig.id,
      name: sig.name,
      personName: sig.personName,
      position: sig.position,
      phone: sig.phone,
      linkedInUrl: sig.linkedInUrl,
      websiteUrl: sig.websiteUrl,
    });
    setShowForm(true);
  }

  function openShare(sig: SignatureDoc) {
    setShareTargetId(sig.id);
    setShareRoles(sig.sharedWithRoles);
    setSharePodIds(sig.sharedWithPodIds);
    setShareEmails(sig.sharedWithEmails);
    setEmailDraft("");
  }

  async function handleSaveShare() {
    if (!user || !shareTargetId) return;
    await fetch("/api/signatures", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorRole: user.role,
        id: shareTargetId,
        data: {
          sharedWithRoles: shareRoles,
          sharedWithPodIds: sharePodIds,
          sharedWithEmails: shareEmails,
        },
      }),
    });
    await fetchSignatures();
    setShareTargetId(null);
  }

  function toggleRole(role: string) {
    setShareRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function togglePod(pId: string) {
    setSharePodIds((prev) => (prev.includes(pId) ? prev.filter((r) => r !== pId) : [...prev, pId]));
  }

  function addEmail(email: string) {
    const e = email.trim().toLowerCase();
    if (!e) return;
    if (shareEmails.includes(e)) return;
    setShareEmails((prev) => [...prev, e]);
    setEmailDraft("");
  }

  function removeEmail(email: string) {
    setShareEmails((prev) => prev.filter((e) => e !== email));
  }

  async function resolveEmbeds(): Promise<{ logo?: string; shine?: string }> {
    const [logo, shine] = await Promise.all([
      buildLogoPngDataUri().catch(() => undefined),
      resolveShineSrc(),
    ]);
    return { logo, shine };
  }

  async function copySignatureHtml(sig: SignatureDoc) {
    const plain = [sig.personName, sig.position, sig.phone, sig.linkedInUrl, sig.websiteUrl]
      .filter(Boolean)
      .join("\n");
    // Resolve the embeds up-front so every clipboard path (ClipboardItem, writeText fallback,
    // execCommand fallback) embeds the logo + animation, not a stripped-down static fallback.
    const { logo, shine } = await resolveEmbeds();
    const html = renderSignatureHtml(sig, logo, shine);
    try {
      const ClipItem = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (ClipItem && navigator.clipboard && "write" in navigator.clipboard) {
        await navigator.clipboard.write([
          new ClipItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      setCopiedId(sig.id);
      setTimeout(() => setCopiedId(null), 1500);
      return;
    } catch {}
    // Last-resort fallback: still include the animation, just as raw HTML on the plain clipboard.
    try {
      await navigator.clipboard.writeText(html);
      setCopiedId(sig.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  }

  async function downloadSignatureFile(sig: SignatureDoc) {
    const safeName = (sig.personName || sig.name || "signature")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const { logo, shine } = await resolveEmbeds();
    const body = renderSignatureHtml(sig, logo, shine);
    const plain = [sig.personName, sig.position, sig.phone, sig.linkedInUrl, sig.websiteUrl]
      .filter(Boolean)
      .join("\\n");
    const doc = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${sig.personName || sig.name} — Thyleads Signature</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { margin:0; padding:32px; background:#f8fafc; font-family:Inter,Arial,sans-serif; color:#0f172a; }
    .wrap { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 18px; margin: 0 0 6px; color:#6800FF; }
    p.lead { font-size: 13px; color:#475569; margin: 0 0 20px; line-height:1.5; }
    ol { font-size: 13px; color:#475569; padding-left: 18px; margin: 0 0 20px; line-height:1.7; }
    ol b { color:#0f172a; }
    .sig-box { background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:24px; box-shadow:0 2px 6px rgba(0,0,0,0.04); }
    .btn { display:inline-flex; align-items:center; gap:6px; background:#6800FF; color:#fff; border:0; padding:10px 16px; border-radius:10px; font-weight:600; font-size:13px; cursor:pointer; margin:16px 0 0; font-family:inherit; }
    .btn:hover { background:#5800DD; }
    .btn.copied { background:#10b981; }
    .hint { font-size: 12px; color:#64748b; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Your Thyleads Signature</h1>
    <p class="lead">Use this page to paste the signature into Gmail.</p>
    <ol>
      <li>Click <b>Copy to clipboard</b> below.</li>
      <li>In Gmail, open <b>Settings → See all settings → General → Signature</b>.</li>
      <li>Create or edit a signature and <b>paste</b> (Cmd/Ctrl + V). Save changes.</li>
    </ol>
    <div class="sig-box" id="sig">${body}</div>
    <button class="btn" id="copyBtn" type="button">Copy to clipboard</button>
    <p class="hint">If the button doesn't work, select the signature above and copy it manually (Cmd/Ctrl + C), then paste into Gmail.</p>
  </div>
  <script>
    (function(){
      var btn = document.getElementById('copyBtn');
      var sig = document.getElementById('sig');
      var html = sig.innerHTML;
      var plain = "${plain.replace(/"/g, '\\"')}";
      btn.addEventListener('click', async function(){
        try {
          if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
              new ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([plain], { type: 'text/plain' })
              })
            ]);
          } else {
            var range = document.createRange();
            range.selectNodeContents(sig);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('copy');
            sel.removeAllRanges();
          }
          btn.textContent = 'Copied! Now paste into Gmail';
          btn.classList.add('copied');
          setTimeout(function(){ btn.textContent = 'Copy to clipboard'; btn.classList.remove('copied'); }, 2500);
        } catch(e) {
          btn.textContent = 'Copy failed — select and copy manually';
        }
      });
    })();
  </script>
</body>
</html>`;
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thyleads-signature-${safeName || "template"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  const editingTarget = signatures.find((s) => s.id === shareTargetId) || null;
  const previewSig: SignatureDoc = {
    id: "preview",
    name: form.name || "preview",
    personName: form.personName || "Full Name",
    position: form.position,
    phone: form.phone,
    linkedInUrl: form.linkedInUrl,
    websiteUrl: form.websiteUrl,
    createdBy: "",
    sharedWithRoles: [],
    sharedWithPodIds: [],
    sharedWithEmails: [],
    createdAt: "",
    updatedAt: "",
  };

  return (
    <div className="px-8 py-8">
      <style dangerouslySetInnerHTML={{ __html: BRAND_STYLES }} />
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-medium text-[#6800FF] tracking-wide uppercase mb-1">Signatures</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isSuperadmin ? "Manage Signatures" : "Shared with me"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSuperadmin
              ? "Create signatures and share them with admins and pods."
              : "Copy and use signatures shared with you."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/signatures/preview-in-gmail"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            Preview in Gmail →
          </a>
          {isSuperadmin && (
            <button
              onClick={() => {
                setForm(BLANK_FORM);
                setShowForm(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#6800FF] hover:bg-[#5800DD] text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <Plus size={15} /> New Signature
            </button>
          )}
        </div>
      </div>

      {isSuperadmin && showForm && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 mb-6">
          <p className="text-sm font-semibold text-slate-700 mb-3">
            {form.id ? "Edit Signature" : "New Signature"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Template name (e.g. Bharath – Business Head)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="col-span-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]" />
            <input placeholder="Full name" value={form.personName} onChange={(e) => setForm({ ...form, personName: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]" />
            <input placeholder="Position (e.g. Business Head | Thyleads)" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]" />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]" />
            <input placeholder="LinkedIn URL" value={form.linkedInUrl} onChange={(e) => setForm({ ...form, linkedInUrl: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#000000]" />
            <input placeholder="Website (e.g. https://www.thyleads.com)" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#000000]" />
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Preview</p>
            <SignatureCard sig={previewSig} />
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={loading || !form.name.trim() || !form.personName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Check size={14} /> {form.id ? "Update" : "Save"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm(BLANK_FORM);
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {signatures.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center">
          <p className="text-slate-500 font-medium">
            {isSuperadmin ? "No signatures yet" : "Nothing shared with you yet"}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {isSuperadmin
              ? "Click New Signature to create the first template."
              : "Ask the superadmin to share a template with you."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {signatures.map((sig) => {
            const sharedCount =
              sig.sharedWithRoles.length + sig.sharedWithPodIds.length + sig.sharedWithEmails.length;
            return (
              <div key={sig.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{sig.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Updated {new Date(sig.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isSuperadmin && (
                      <span className="text-[10px] bg-[#f0e6ff] text-[#6800FF] font-semibold px-2 py-0.5 rounded-full">
                        {sharedCount === 0 ? "Unshared" : `Shared with ${sharedCount}`}
                      </span>
                    )}
                    <button
                      onClick={() => copySignatureHtml(sig)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      {copiedId === sig.id ? (
                        <>
                          <Check size={13} /> Copied — paste into Gmail
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copy for Gmail
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => downloadSignatureFile(sig)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f0e6ff] hover:bg-[#e0ccff] text-[#6800FF] text-xs font-medium rounded-lg transition-colors"
                    >
                      <Download size={13} /> Download
                    </button>
                    {isSuperadmin && (
                      <>
                        <button
                          onClick={() => startEdit(sig)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => openShare(sig)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <Share2 size={13} /> Share
                        </button>
                        <button
                          onClick={() => handleDelete(sig.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <SignatureCard sig={sig} />
              </div>
            );
          })}
        </div>
      )}

      {isSuperadmin && editingTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShareTargetId(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Share Signature</h3>
                <p className="text-xs text-slate-400 mt-0.5">{editingTarget.name}</p>
              </div>
              <button onClick={() => setShareTargetId(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Share with roles</p>
                <div className="flex flex-wrap gap-2">
                  {(["admin", "pod"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => toggleRole(r)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize ${
                        shareRoles.includes(r)
                          ? "bg-[#6800FF] border-[#6800FF] text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:border-[#6800FF]"
                      }`}
                    >
                      All {r}s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Share with specific pods</p>
                <div className="flex flex-wrap gap-2">
                  {pods.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => togglePod(p.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        sharePodIds.includes(p.id)
                          ? "bg-[#6800FF] border-[#6800FF] text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:border-[#6800FF]"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Share with specific users</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {shareEmails.map((e) => (
                    <span key={e} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-[#f0e6ff] text-[#6800FF] text-xs font-medium rounded-lg">
                      {e}
                      <button onClick={() => removeEmail(e)} className="p-0.5 hover:bg-[#e0ccff] rounded">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]"
                  >
                    <option value="">Select a user…</option>
                    {availableTargets
                      .filter((u) => !shareEmails.includes(u.email.toLowerCase()))
                      .map((u) => (
                        <option key={u.email} value={u.email.toLowerCase()}>
                          {u.name} — {u.email}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => addEmail(emailDraft)}
                    disabled={!emailDraft}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setShareTargetId(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveShare} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#6800FF] hover:bg-[#5800DD] text-white text-sm font-medium rounded-lg transition-colors">
                <Check size={14} /> Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
