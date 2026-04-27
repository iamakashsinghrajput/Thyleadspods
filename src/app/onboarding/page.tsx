"use client";

import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import OnboardingDashboard from "@/components/onboarding/onboarding";

export default function OnboardingPage() {
  const { user } = useAuth();
  if (!user) return null;
  const isAdmin = user.role === "superadmin" || user.role === "admin";
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-8 text-center max-w-md">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 mx-auto flex items-center justify-center">
            <ShieldAlert size={22} className="text-amber-700" />
          </div>
          <h1 className="text-base font-bold text-slate-900 mt-3">Admins only</h1>
          <p className="text-xs text-slate-600 mt-1.5">
            The onboarding pipeline is restricted to admins and superadmins. Ask your admin if you need access.
          </p>
        </div>
      </div>
    );
  }
  return <OnboardingDashboard />;
}
