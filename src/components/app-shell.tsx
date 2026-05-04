"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import LoginPage from "@/components/login-page";
import Sidebar from "@/components/sidebar";
import ClientPortal from "@/components/client-portal";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useAuth();
  const pathname = usePathname();

  const isPublic = pathname?.startsWith("/onboarding-form/");
  if (isPublic) {
    return <main className="flex-1 overflow-auto bg-slate-50">{children}</main>;
  }

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

  if (user.role === "client") {
    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-[#F8F9FA]">
        <ClientPortal />
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-100/60">
        {children}
      </main>
    </>
  );
}
