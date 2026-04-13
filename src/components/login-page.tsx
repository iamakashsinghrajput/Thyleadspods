"use client";

import { useState, useRef, useEffect } from "react";
import { AlertCircle, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2, Mail } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { GoogleLogin } from "@react-oauth/google";

type View = "login" | "register" | "forgot" | "otp" | "reset" | "success";


export default function LoginPage() {
  const { login, loginWithGoogle, setUser } = useAuth();
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpType, setOtpType] = useState<"verify" | "reset" | "login">("verify");
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function resetForm() {
    setEmail(""); setPassword(""); setConfirmPassword(""); setName("");
    setError(""); setSuccess(""); setOtp(["", "", "", "", "", ""]);
  }

  function goTo(v: View) { resetForm(); setView(v); }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.toLowerCase().endsWith("@thyleads.com") && email.toLowerCase() !== "akash21052000singh@gmail.com") { setError("Only @thyleads.com accounts are allowed"); return; }
    setError(""); setLoading(true);
    const err = await login(email, password);
    setLoading(false);
    if (err === "NEEDS_VERIFICATION") {
      setOtpType("verify");
      setView("otp");
      setCountdown(0);
      return;
    }
    if (err === "NEEDS_LOGIN_OTP") {
      setOtpType("login");
      setView("otp");
      setCountdown(60);
      return;
    }
    if (err) setError(err);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.toLowerCase().endsWith("@thyleads.com") && email.toLowerCase() !== "akash21052000singh@gmail.com") { setError("Only @thyleads.com accounts are allowed"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      setOtpType("verify");
      setView("otp");
      setCountdown(60);
    } catch { setError("Network error"); }
    setLoading(false);
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.toLowerCase().endsWith("@thyleads.com") && email.toLowerCase() !== "akash21052000singh@gmail.com") { setError("Only @thyleads.com accounts are allowed"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      setOtpType("reset");
      setView("otp");
      setCountdown(60);
    } catch { setError("Network error"); }
    setLoading(false);
  }

  function handleOtpChange(index: number, value: string) {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
  }

  async function handleVerifyOtp() {
    const code = otp.join("");
    if (code.length !== 6) { setError("Enter the full 6-digit code"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code, type: otpType }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }

      if ((otpType === "verify" || otpType === "login") && data.user) {
        setUser(data.user);
        setView("success");
        setSuccess(otpType === "login" ? "Login successful! Redirecting..." : "Account verified! Redirecting...");
        setTimeout(() => window.location.href = "/", 1500);
      } else if (otpType === "reset") {
        setView("reset");
      }
    } catch { setError("Network error"); }
    setLoading(false);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      setView("success");
      setSuccess("Password reset! You can now sign in.");
    } catch { setError("Network error"); }
    setLoading(false);
  }

  async function resendOtp() {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: otpType }),
      });
      setCountdown(60);
      setSuccess("OTP resent!");
      setTimeout(() => setSuccess(""), 3000);
    } catch {}
    setLoading(false);
  }

  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) return;
    setError(""); setLoading(true);
    const err = await loginWithGoogle(credentialResponse.credential);
    setLoading(false);
    if (err) setError(err);
  }

  const inputClass = "w-full px-5 py-3.5 bg-[#F7F7F9] border border-transparent rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all";

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] p-4 sm:p-6 lg:p-8 flex items-center justify-center font-sans">
      <div className="w-full max-w-[1400px] h-[90vh] min-h-[700px] bg-white rounded-[2.5rem] flex overflow-hidden shadow-2xl relative">

        <div className="hidden lg:flex lg:w-[48%] relative m-3 rounded-[2rem] overflow-hidden flex-col justify-between p-12">
          <img
            src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
            alt="Abstract Fluid Background"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

          <div className="relative z-10 flex items-center gap-4">
            <span className="text-white/90 text-xs font-semibold tracking-[0.2em] uppercase">
              Thyleads
            </span>
            <div className="h-[1px] w-12 bg-white/40" />
          </div>

          <div className="relative z-10 mb-8">
            <h1 className="text-5xl xl:text-6xl text-white font-serif tracking-tight leading-[1.1] mb-6">
              Track.<br />
              Manage.<br />
              Deliver.
            </h1>
            <p className="text-white/80 text-sm max-w-[320px] leading-relaxed font-light">
              Employee tracking dashboard for managing attendance, projects, pod assignments, and team performance.
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center p-8 lg:p-12 overflow-y-auto">
          <div className="w-full flex justify-center mb-auto pt-2">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="Thyleads" width={32} height={32} className="rounded-lg" />
              <span className="text-xl font-medium tracking-tight text-slate-900">Thyleads</span>
            </div>
          </div>

          <div className="w-full max-w-[380px] my-auto py-10">

            {view === "login" && (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-[2.5rem] font-serif text-slate-900 tracking-tight mb-3">Welcome Back</h2>
                  <p className="text-slate-500 text-sm font-light">Enter your credentials to access your account</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  {error && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                      <AlertCircle size={16} className="shrink-0" /> {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Email</label>
                    <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className={inputClass} placeholder="Enter your email" required />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className={`${inputClass} pr-12`} placeholder="Enter your password" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" className="peer appearance-none w-4 h-4 border border-slate-300 rounded focus:ring-2 focus:ring-black/20 checked:bg-black checked:border-black transition-colors cursor-pointer" />
                        <svg className="absolute w-2.5 h-2.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-slate-600 group-hover:text-slate-900 transition-colors">Remember me</span>
                    </label>
                    <button type="button" onClick={() => goTo("forgot")} className="text-[#6800FF] hover:text-[#5800DD] font-medium transition-colors">
                      Forgot password?
                    </button>
                  </div>

                  <div className="pt-4 space-y-3">
                    <button type="submit" disabled={loading} className="w-full py-3.5 bg-black hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-medium rounded-2xl transition-all shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] flex items-center justify-center gap-2">
                      {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : "Sign In"}
                    </button>
                  </div>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                  <div className="relative flex justify-center"><span className="px-4 bg-white text-xs text-slate-400 uppercase tracking-wider">or continue with</span></div>
                </div>

                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError("Google sign-in failed")}
                    theme="outline"
                    size="large"
                    width="380"
                    text="signin_with"
                    shape="pill"
                    hosted_domain="thyleads.com"
                  />
                </div>

                <p className="text-center text-sm text-slate-500 mt-6">
                  Don&apos;t have an account?{" "}
                  <button onClick={() => goTo("register")} className="text-[#6800FF] hover:text-[#5800DD] font-semibold transition-colors">
                    Sign Up
                  </button>
                </p>
              </>
            )}

            {view === "register" && (
              <>
                <div className="mb-6">
                  <button onClick={() => goTo("login")} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors mb-4">
                    <ArrowLeft size={14} /> Back to sign in
                  </button>
                  <h2 className="text-3xl font-serif text-slate-900 tracking-tight mb-2">Create Account</h2>
                  <p className="text-slate-500 text-sm font-light">Fill in the details to get started</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                      <AlertCircle size={16} className="shrink-0" /> {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Full Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Enter your name" required />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="Enter your email" required />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-12`} placeholder="Min 6 characters" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Re-enter password" required />
                  </div>

                  <button type="submit" disabled={loading} className="w-full py-3.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-medium rounded-2xl transition-all mt-2 flex items-center justify-center gap-2">
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : "Create Account"}
                  </button>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                  <div className="relative flex justify-center"><span className="px-4 bg-white text-xs text-slate-400 uppercase tracking-wider">or</span></div>
                </div>

                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError("Google sign-in failed")}
                    theme="outline"
                    size="large"
                    width="380"
                    text="signup_with"
                    shape="pill"
                  />
                </div>

                <p className="text-center text-sm text-slate-500 mt-6">
                  Already have an account?{" "}
                  <button onClick={() => goTo("login")} className="text-[#6800FF] hover:text-[#5800DD] font-semibold transition-colors">
                    Sign In
                  </button>
                </p>
              </>
            )}

            {view === "forgot" && (
              <>
                <div className="mb-6">
                  <button onClick={() => goTo("login")} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors mb-4">
                    <ArrowLeft size={14} /> Back to sign in
                  </button>
                  <h2 className="text-3xl font-serif text-slate-900 tracking-tight mb-2">Forgot Password?</h2>
                  <p className="text-slate-500 text-sm font-light">Enter your email and we&apos;ll send you a reset code</p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                      <AlertCircle size={16} className="shrink-0" /> {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="Enter your email" required />
                  </div>

                  <button type="submit" disabled={loading} className="w-full py-3.5 bg-black hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-medium rounded-2xl transition-all flex items-center justify-center gap-2">
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : "Send Reset Code"}
                  </button>
                </form>
              </>
            )}

            {view === "otp" && (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#6800FF]/10 flex items-center justify-center">
                    <Mail size={28} className="text-[#6800FF]" />
                  </div>
                  <h2 className="text-3xl font-serif text-slate-900 tracking-tight mb-2">
                    {otpType === "login" ? "Verify Your Identity" : "Check Your Email"}
                  </h2>
                  <p className="text-slate-500 text-sm font-light">
                    {otpType === "login"
                      ? <>We sent a 6-digit verification code to <span className="font-medium text-slate-700">{email}</span></>
                      : <>We sent a 6-digit code to <span className="font-medium text-slate-700">{email}</span></>
                    }
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm mb-4">
                    <AlertCircle size={16} className="shrink-0" /> {error}
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-sm mb-4">
                    <CheckCircle2 size={16} className="shrink-0" /> {success}
                  </div>
                )}

                <div className="flex justify-center gap-3 mb-6" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all focus:outline-none ${
                        digit ? "border-[#6800FF] bg-[#6800FF]/5 text-[#6800FF]" : "border-slate-200 bg-[#F7F7F9] text-slate-900"
                      } focus:border-[#6800FF] focus:ring-4 focus:ring-[#6800FF]/10`}
                    />
                  ))}
                </div>

                <button onClick={handleVerifyOtp} disabled={loading || otp.join("").length !== 6} className="w-full py-3.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-medium rounded-2xl transition-all flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : "Verify Code"}
                </button>

                <p className="text-center text-sm text-slate-500 mt-4">
                  Didn&apos;t receive the code?{" "}
                  {countdown > 0 ? (
                    <span className="text-slate-400">Resend in {countdown}s</span>
                  ) : (
                    <button onClick={resendOtp} disabled={loading} className="text-[#6800FF] hover:text-[#5800DD] font-semibold transition-colors">
                      Resend
                    </button>
                  )}
                </p>

                <button onClick={() => goTo("login")} className="flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors mt-4 mx-auto">
                  <ArrowLeft size={14} /> Back to sign in
                </button>
              </>
            )}

            {view === "reset" && (
              <>
                <div className="mb-6">
                  <h2 className="text-3xl font-serif text-slate-900 tracking-tight mb-2">Set New Password</h2>
                  <p className="text-slate-500 text-sm font-light">Choose a strong password for your account</p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                      <AlertCircle size={16} className="shrink-0" /> {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">New Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-12`} placeholder="Min 6 characters" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Re-enter password" required />
                  </div>

                  <button type="submit" disabled={loading} className="w-full py-3.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-medium rounded-2xl transition-all flex items-center justify-center gap-2">
                    {loading ? <><Loader2 size={16} className="animate-spin" /> Resetting...</> : "Reset Password"}
                  </button>
                </form>
              </>
            )}

            {view === "success" && (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 size={40} className="text-emerald-500" />
                </div>
                <h2 className="text-3xl font-serif text-slate-900 tracking-tight mb-3">Success!</h2>
                <p className="text-slate-500 text-sm mb-6">{success}</p>
                <button onClick={() => goTo("login")} className="px-8 py-3 bg-black hover:bg-slate-800 text-white text-sm font-medium rounded-2xl transition-all">
                  Go to Sign In
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
