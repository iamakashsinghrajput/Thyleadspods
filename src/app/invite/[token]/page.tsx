"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Check, AlertTriangle, Mail, Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface InviteInfo {
  name: string;
  email: string;
  role: string;
  verified: boolean;
  expiresAt: string | null;
}

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { setUser, loginWithGoogle } = useAuth();
  const token = params?.token || "";

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setErr(data.error || "Invite not found");
        } else {
          setInvite(data.invite);
          setName(data.invite.name || "");
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Network error");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function submitPassword() {
    if (!invite) return;
    if (password.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setErr("Passwords do not match."); return; }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/auth/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || `Failed (${res.status})`);
        setBusy(false);
        return;
      }
      setUser(data.user);
      router.push("/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
      setBusy(false);
    }
  }

  async function googleSignIn(credential: string) {
    setBusy(true);
    setErr("");
    const error = await loginWithGoogle(credential);
    if (error) {
      setErr(error);
      setBusy(false);
      return;
    }
    router.push("/");
  }

  useEffect(() => {
    if (!invite) return;
    const w = window as unknown as { google?: { accounts?: { id?: { initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void; renderButton: (el: HTMLElement, opts: { theme: string; size: string; text: string; width: number }) => void } } } };
    if (!w.google?.accounts?.id) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    const target = document.getElementById("google-signin-btn");
    if (!target) return;
    w.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => { if (response?.credential) googleSignIn(response.credential); },
    });
    w.google.accounts.id.renderButton(target, { theme: "outline", size: "large", text: "signin_with", width: 320 });
  }, [invite]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={20} className="text-[#6800FF] animate-spin" />
      </div>
    );
  }

  if (err && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-sm text-center space-y-2">
          <AlertTriangle size={28} className="mx-auto text-red-500" />
          <p className="text-base font-bold text-slate-900">Invite not valid</p>
          <p className="text-xs text-slate-500">{err}</p>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 px-4 py-10">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/5 max-w-md w-full overflow-hidden">
        <div className="bg-linear-to-br from-[#6800FF] to-[#9b00ff] text-white px-6 py-5">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80 inline-flex items-center gap-1.5">
            <Sparkles size={12} /> Thyleads dashboard
          </p>
          <h1 className="text-xl font-bold mt-1">Welcome, {invite.name}</h1>
          <p className="text-sm opacity-90 mt-0.5">You&apos;ve been invited as <strong>{invite.role}</strong>.</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Mail size={12} /><span className="font-mono">{invite.email}</span>
            </div>
            {invite.expiresAt && (
              <p className="text-[10px] text-slate-400 mt-1">Invite expires {new Date(invite.expiresAt).toLocaleDateString()}</p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">Sign in with Google Workspace</p>
            <div id="google-signin-btn" className="flex justify-center min-h-[44px] items-center">
              <span className="text-[11px] text-slate-400">If Google button doesn&apos;t load, use password below.</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Set a password</p>
            <div>
              <label className="text-[11px] font-medium text-slate-600">Display name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600 inline-flex items-center gap-1"><Lock size={11} /> Password (min 6 chars)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-600">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitPassword(); }}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15"
              />
            </div>
            {err && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 inline-flex items-start gap-1.5">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {err}
              </div>
            )}
            <button
              onClick={submitPassword}
              disabled={busy || !password || password !== confirmPassword}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg"
            >
              {busy ? <><Loader2 size={14} className="animate-spin" /> Setting up…</> : <><Check size={14} /> Activate account</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
