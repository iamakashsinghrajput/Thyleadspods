"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Share2, Trash2, Copy, Check, X, Pencil, Download } from "lucide-react";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { useAuth } from "@/lib/auth-context";
import { usePods } from "@/lib/pod-context";
import { SEED_USERS } from "@/lib/seed-users";

const FLIP_GIF_W = 224;
const FLIP_GIF_H = 88;
let cachedFlipGif: string | null = null;

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
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const FRONT_CONTENT = `<g transform="translate(48 18) scale(0.65)"><path d="M33.54 78V20.0792H12.48V10.8119H67.86V27.0297H78V0H0V30.8911H21.84V78H33.54Z" fill="#6800FF"/><path d="M55.38 20.0792H43.68V78H78V68.7327H55.38V20.0792Z" fill="#6800FF"/></g><text x="108" y="52" font-family="Arial,Helvetica,sans-serif" font-size="22" fill="#cbd5e1">|</text><text x="120" y="52" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" fill="#6800FF">Thyleads</text>`;

const BACK_CONTENT = `<text x="${FLIP_GIF_W / 2}" y="22" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700" fill="#6800FF">Thyleads</text><rect x="${FLIP_GIF_W / 2 - 18}" y="28" width="36" height="1" fill="#6800FF" opacity="0.3"/><g font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="600" fill="#6800FF"><circle cx="54" cy="46" r="1.8"/><text x="60" y="49">AI-Powered Outbound</text><circle cx="54" cy="62" r="1.8"/><text x="60" y="65">Inbound Qualification</text><circle cx="54" cy="78" r="1.8"/><text x="60" y="81">Deal Momentum</text></g>`;

function frameSvg(side: "front" | "back", sx: number): string {
  const body = side === "front" ? FRONT_CONTENT : BACK_CONTENT;
  const cx = FLIP_GIF_W / 2;
  const scale = Math.max(sx, 0.001);
  const skewY = side === "front" ? (1 - sx) * -3 : (1 - sx) * 3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FLIP_GIF_W}" height="${FLIP_GIF_H}" viewBox="0 0 ${FLIP_GIF_W} ${FLIP_GIF_H}"><rect width="100%" height="100%" fill="#ffffff"/><g transform="translate(${cx} 0) matrix(${scale} 0 ${skewY * 0.01} 1 0 0) translate(${-cx} 0)">${body}</g></svg>`;
}

async function buildFlipGifDataUri(): Promise<string> {
  if (cachedFlipGif) return cachedFlipGif;
  const W = FLIP_GIF_W;
  const H = FLIP_GIF_H;

  const holdMs = 1600;
  const stepMs = 55;
  const flipSteps = [0.92, 0.75, 0.55, 0.35, 0.18, 0.06];

  type Frame = { side: "front" | "back"; sx: number; delay: number };
  const frames: Frame[] = [
    { side: "front", sx: 1, delay: holdMs },
    ...flipSteps.map<Frame>((sx) => ({ side: "front", sx, delay: stepMs })),
    ...flipSteps.slice().reverse().map<Frame>((sx) => ({ side: "back", sx, delay: stepMs })),
    { side: "back", sx: 1, delay: holdMs },
    ...flipSteps.map<Frame>((sx) => ({ side: "back", sx, delay: stepMs })),
    ...flipSteps.slice().reverse().map<Frame>((sx) => ({ side: "front", sx, delay: stepMs })),
  ];

  const raster = await Promise.all(frames.map((f) => rasterizeSvgToImageData(frameSvg(f.side, f.sx), W, H)));

  const encoder = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    const data = raster[i];
    const palette = quantize(data, 32);
    encoder.writeFrame(applyPalette(data, palette), W, H, {
      palette,
      delay: frames[i].delay,
      dispose: 2,
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
  cachedFlipGif = `data:image/gif;base64,${btoa(binary)}`;
  return cachedFlipGif;
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

const STAGE_STYLES = `
.thy-stage-wrap { perspective: 1200px; }
.thy-stage-wrap:hover .thy-flipper { animation-play-state: paused; }
.thy-flipper {
  transform-style: preserve-3d;
  animation: thy-flip 7s infinite cubic-bezier(0.7, 0, 0.3, 1);
}
.thy-face {
  position: absolute;
  inset: 0;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}
.thy-back { transform: rotateY(180deg); }
@keyframes thy-flip {
  0%, 35%   { transform: rotateY(0deg); }
  50%, 85%  { transform: rotateY(180deg); }
  100%     { transform: rotateY(360deg); }
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

function LogoFace() {
  return (
    <div className="w-full h-full flex items-center justify-center gap-2.5">
      <ThyMarkSvg className="w-14 h-14 shrink-0" fill="#6800FF" />
      <span className="text-slate-300 text-3xl font-light leading-none select-none">|</span>
      <span className="text-[#6800FF] text-[22px] font-bold tracking-[0.04em]">Thyleads</span>
    </div>
  );
}

const OFFERINGS = ["AI-Powered Outbound", "Inbound Qualification", "Deal Momentum"];

function OfferingsFace() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
      <div className="flex flex-col items-center">
        <span className="text-[#6800FF] text-[24px] font-bold tracking-[0.04em] leading-none">Thyleads</span>
        <span className="mt-1.5 h-px w-10 bg-[#6800FF]/30" aria-hidden />
      </div>
      <ul className="space-y-1 text-[9.5px] font-semibold text-[#6800FF] tracking-[0.02em]">
        {OFFERINGS.map((o) => (
          <li key={o} className="flex items-center gap-1.5 leading-none">
            <span className="w-1 h-1 rounded-full bg-[#6800FF]" />
            {o}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThyProcessCard() {
  return (
    <div className="thy-stage-wrap w-56 h-28 shrink-0 relative">
      <div className="thy-flipper relative w-full h-full">
        <div className="thy-face">
          <LogoFace />
        </div>
        <div className="thy-face thy-back">
          <OfferingsFace />
        </div>
      </div>
    </div>
  );
}

function renderSignatureHtml(sig: SignatureDoc, gifDataUri?: string): string {
  const linkedIn = sig.linkedInUrl
    ? `<a href="${sig.linkedInUrl}" style="color:#6800FF;text-decoration:underline;font-weight:600;">Linkedin</a>`
    : "";
  const website = sig.websiteUrl
    ? `<a href="${sig.websiteUrl}" style="color:#6800FF;text-decoration:underline;font-weight:600;">${sig.websiteUrl.replace(/^https?:\/\//, "")}</a>`
    : "";
  const sep = linkedIn && website ? `<span style="color:#d1d5db;margin:0 8px;">|</span>` : "";
  const staticLogo = `<table cellpadding="0" cellspacing="0" role="presentation"><tr><td style="vertical-align:middle;padding-right:8px;"><svg width="36" height="36" viewBox="0 0 78 78" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;"><path d="M33.54 78V20.0792H12.48V10.8119H67.86V27.0297H78V0H0V30.8911H21.84V78H33.54Z" fill="#6800FF"/><path d="M55.38 20.0792H43.68V78H78V68.7327H55.38V20.0792Z" fill="#6800FF"/></svg></td><td style="vertical-align:middle;color:#d1d5db;font-size:22px;padding-right:8px;">|</td><td style="vertical-align:middle;color:#6800FF;font-size:16px;font-weight:700;letter-spacing:0.5px;">Thyleads</td></tr></table>`;
  const brandBlock = gifDataUri
    ? `<img src="${gifDataUri}" alt="Thyleads" width="${FLIP_GIF_W}" height="${FLIP_GIF_H}" style="display:block;border:0;outline:none;"/>`
    : staticLogo;
  return `
<table cellpadding="0" cellspacing="0" style="font-family:Inter,Arial,sans-serif;color:#111827;">
  <tr>
    <td style="vertical-align:middle;padding-right:20px;border-right:1px solid #e2e8f0;">
      ${brandBlock}
    </td>
    <td style="vertical-align:middle;padding-left:20px;">
      <div style="font-size:20px;font-weight:700;color:#6800FF;line-height:1.1;">${sig.personName}</div>
      <div style="font-size:14px;font-weight:600;color:#111827;margin-top:4px;">${sig.position}</div>
      <div style="margin-top:8px;color:#6b7280;font-size:13px;line-height:1.5;">
        <div>${sig.phone}</div>
      </div>
      <div style="margin-top:6px;font-size:13px;">${linkedIn}${sep}${website}</div>
    </td>
  </tr>
</table>`.trim();
}

function SignatureCard({ sig }: { sig: SignatureDoc }) {
  return (
    <div className="bg-white px-6 py-5 rounded-2xl shadow-md shadow-[#6800FF]/10 border border-slate-100 font-[Inter,sans-serif] inline-flex w-full max-w-xl">
      <div className="flex items-center gap-5 w-full">
        <ThyProcessCard />

        <div className="w-px self-stretch bg-slate-200" aria-hidden />

        <div className="flex flex-col min-w-0 flex-1">
          <h1 className="text-[19px] font-bold text-[#6800FF] leading-tight truncate">{sig.personName || "Full name"}</h1>
          {sig.position && <h2 className="text-[13px] font-semibold text-slate-800 mt-0.5 truncate">{sig.position}</h2>}
          {sig.phone && <p className="text-[12px] text-slate-500 mt-2 tracking-wide">{sig.phone}</p>}
          {(sig.linkedInUrl || sig.websiteUrl) && (
            <div className="mt-1.5 text-[12px] font-semibold">
              {sig.linkedInUrl && (
                <a href={sig.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-[#6800FF] hover:text-indigo-800 transition-colors underline decoration-1 underline-offset-2">
                  Linkedin
                </a>
              )}
              {sig.linkedInUrl && sig.websiteUrl && <span className="mx-1.5 text-slate-300">|</span>}
              {sig.websiteUrl && (
                <a href={sig.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-[#6800FF] hover:text-indigo-800 transition-colors underline decoration-1 underline-offset-2">
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

  async function copySignatureHtml(sig: SignatureDoc) {
    const plain = [sig.personName, sig.position, sig.phone, sig.linkedInUrl, sig.websiteUrl]
      .filter(Boolean)
      .join("\n");
    try {
      const ClipItem = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (ClipItem && navigator.clipboard && "write" in navigator.clipboard) {
        const htmlPromise = buildFlipGifDataUri()
          .catch(() => undefined)
          .then((gif) => new Blob([renderSignatureHtml(sig, gif)], { type: "text/html" }));
        await navigator.clipboard.write([
          new ClipItem({
            "text/html": htmlPromise,
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        const gif = await buildFlipGifDataUri().catch(() => undefined);
        await navigator.clipboard.writeText(renderSignatureHtml(sig, gif));
      }
      setCopiedId(sig.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      try {
        await navigator.clipboard.writeText(renderSignatureHtml(sig));
        setCopiedId(sig.id);
        setTimeout(() => setCopiedId(null), 1500);
      } catch {}
    }
  }

  async function downloadSignatureFile(sig: SignatureDoc) {
    const safeName = (sig.personName || sig.name || "signature")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const gif = await buildFlipGifDataUri().catch(() => undefined);
    const body = renderSignatureHtml(sig, gif);
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
      <style dangerouslySetInnerHTML={{ __html: STAGE_STYLES }} />

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
            <input placeholder="LinkedIn URL" value={form.linkedInUrl} onChange={(e) => setForm({ ...form, linkedInUrl: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]" />
            <input placeholder="Website (e.g. https://www.thyleads.com)" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]" />
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
