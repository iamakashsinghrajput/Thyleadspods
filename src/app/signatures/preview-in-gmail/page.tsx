"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Copy, Check, Mail, Smartphone, Monitor } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { renderSignatureHtml, resolveEmailAssets } from "@/lib/signature-email";

interface SignatureDoc {
  id: string;
  name: string;
  personName: string;
  position: string;
  phone: string;
  linkedInUrl: string;
  websiteUrl: string;
}

type Surface = "desktop" | "mobile";

// Gmail's actual signature wrapper — we reproduce the relevant bits to mirror how
// pasted content ends up rendering inside the reply/compose thread.
function buildGmailFrameHtml(signatureHtml: string, surface: Surface): string {
  const stageWidth = surface === "mobile" ? 380 : 780;
  const bodyFont = "'Google Sans', 'Helvetica Neue', Arial, sans-serif";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <base target="_blank" />
  <style>
    html, body { margin: 0; padding: 0; background: #f6f8fc; font-family: ${bodyFont}; color: #202124; }
    .gm-wrap { max-width: ${stageWidth}px; margin: 0 auto; padding: ${surface === "mobile" ? "16px" : "32px"}; }
    .gm-card { background: #ffffff; border: 1px solid #e0e0e0; border-radius: ${surface === "mobile" ? "12px" : "16px"}; box-shadow: 0 1px 2px rgba(60,64,67,0.08); overflow: hidden; }
    .gm-head { padding: 14px 18px; border-bottom: 1px solid #eef0f3; display: flex; align-items: center; gap: 12px; }
    .gm-avatar { width: 32px; height: 32px; border-radius: 50%; background: #1a73e8; color: #fff; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; }
    .gm-from { font-size: 13px; }
    .gm-from b { font-weight: 600; color: #202124; }
    .gm-from span { color: #5f6368; }
    .gm-body { padding: 22px 18px; font-size: 14px; line-height: 1.6; color: #202124; }
    .gm-body p { margin: 0 0 14px; }
    .gm-sep { height: 1px; background: #e8eaed; margin: 18px 0 14px; }
  </style>
</head>
<body>
  <div class="gm-wrap">
    <div class="gm-card">
      <div class="gm-head">
        <div class="gm-avatar">T</div>
        <div class="gm-from">
          <div><b>Thyleads Team</b> <span>&lt;hello@thyleads.com&gt;</span></div>
          <div><span>to me</span></div>
        </div>
      </div>
      <div class="gm-body">
        <p>Hi there,</p>
        <p>Just a quick note — wanted to share a couple of updates from our side. Looking forward to catching up soon.</p>
        <p>Best,</p>
        <div class="gm-sep"></div>
        <div class="gm-signature">${signatureHtml}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default function PreviewInGmailPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [signatures, setSignatures] = useState<SignatureDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [surface, setSurface] = useState<Surface>("desktop");
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [copiedRaw, setCopiedRaw] = useState(false);
  // Seed with a timestamp so first render uses a unique cache-bust token rather than `?t=0`,
  // which Vercel's CDN might have cached from an earlier broken deploy.
  const [refreshKey, setRefreshKey] = useState(() => Date.now());
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const selected = useMemo(() => signatures.find((s) => s.id === selectedId), [signatures, selectedId]);

  const fetchSignatures = useCallback(async () => {
    if (!user) return;
    try {
      const params = new URLSearchParams({ role: user.role, email: user.email, podId: user.podId || "" });
      const res = await fetch(`/api/signatures?${params.toString()}`);
      const data = await res.json();
      setSignatures((data.signatures || []) as SignatureDoc[]);
      if ((data.signatures || []).length > 0 && !selectedId) setSelectedId(data.signatures[0].id);
    } catch {}
  }, [user, selectedId]);

  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchSignatures(); })();
    return () => { ignore = true; };
  }, [fetchSignatures]);

  const buildAndRender = useCallback(async () => {
    if (!selected) return;
    const assets = await resolveEmailAssets();
    const sig = renderSignatureHtml(selected, assets);
    setRenderedHtml(buildGmailFrameHtml(sig, surface));
  }, [selected, surface]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (ignore) return;
      await buildAndRender();
    })();
    return () => { ignore = true; };
  }, [buildAndRender, refreshKey]);

  async function copyRawHtml() {
    try {
      await navigator.clipboard.writeText(renderedHtml);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 1500);
    } catch {}
  }

  if (!user) return null;

  return (
    <div className="min-h-full">
      <div className="px-8 pt-6 pb-4">
        <button onClick={() => router.push("/signatures")} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#6800FF] transition-colors mb-4">
          <ArrowLeft size={14} />
          Back to signatures
        </button>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-[#6800FF] tracking-wide uppercase mb-1">Dev preview</p>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Mail size={20} className="text-[#6800FF]" />
              Preview in Gmail
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-lg">
              This renders your signature inside a simulated Gmail thread — including the hosted shine animation URL — so you can see exactly what a recipient would see without pasting into a real inbox.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF] shadow-sm"
            >
              {signatures.length === 0 && <option value="">No signatures yet</option>}
              {signatures.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.personName}</option>
              ))}
            </select>
            <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
              <button
                onClick={() => setSurface("desktop")}
                className={`px-3 py-2 text-sm inline-flex items-center gap-1.5 transition-colors ${surface === "desktop" ? "bg-[#6800FF] text-white" : "text-slate-500 hover:bg-slate-50"}`}
              >
                <Monitor size={14} /> Desktop
              </button>
              <button
                onClick={() => setSurface("mobile")}
                className={`px-3 py-2 text-sm inline-flex items-center gap-1.5 transition-colors ${surface === "mobile" ? "bg-[#6800FF] text-white" : "text-slate-500 hover:bg-slate-50"}`}
              >
                <Smartphone size={14} /> Mobile
              </button>
            </div>
            <button
              onClick={() => setRefreshKey(Date.now())}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors"
              title="Reload preview"
            >
              <RefreshCw size={14} /> Reload
            </button>
            <button
              onClick={copyRawHtml}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#6800FF] hover:bg-[#5800DD] text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
            >
              {copiedRaw ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy frame HTML</>}
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 pb-10">
        {selected ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 bg-slate-50/70 border-b border-slate-200/80 text-[11px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="ml-3 font-mono">gmail.com / inbox</span>
              <span className="ml-auto text-slate-400 font-medium">{surface === "mobile" ? "380 × auto" : "780 × auto"}</span>
            </div>
            <iframe
              key={`${selected.id}:${surface}:${refreshKey}`}
              ref={iframeRef}
              srcDoc={renderedHtml}
              title="Gmail preview"
              sandbox="allow-same-origin"
              className="w-full border-0"
              style={{ height: surface === "mobile" ? 520 : 560, background: "#f6f8fc" }}
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center">
            <p className="text-slate-500 font-medium">No signature selected</p>
            <p className="text-slate-400 text-sm mt-1">Create a signature on the Signatures page first, then return here to preview.</p>
          </div>
        )}

        <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 leading-relaxed">
          <p className="font-semibold mb-1">What you&apos;re seeing</p>
          <p>
            The animation is embedded as an inline base64 data URI (same as the Copy-for-Gmail
            clipboard output). This renders identically in Gmail web, Gmail mobile, localhost, or
            production — no hosted URL, no Gmail image-proxy dependency.
          </p>
        </div>
      </div>
    </div>
  );
}
