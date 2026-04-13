"use client";

import { useAuth } from "@/lib/auth-context";
import LoginPage from "@/components/login-page";
import Sidebar from "@/components/sidebar";
import ToastBanner from "@/components/toast-banner";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-50">
        <LoginPage />
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-100/60">
        {children}
      </main>
      <ToastBanner />
    </>
  );
}
