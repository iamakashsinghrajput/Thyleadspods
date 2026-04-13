"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export type UserRole = "superadmin" | "admin" | "pod" | "client";

export interface User {
  name: string;
  email: string;
  role: UserRole;
  podId?: string;
  projectId?: string;
  avatarUrl?: string;
  approverId: string;
}

interface AuthContextType {
  user: User | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  loginWithGoogle: (credential: string) => Promise<string | null>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("thyleads_user");
      if (raw) setUserState(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || seeded) return;
    setSeeded(true);
    fetch("/api/auth/seed", { method: "POST" }).catch(() => {});
  }, [hydrated, seeded]);

  useEffect(() => {
    if (!hydrated) return;
    if (user) {
      localStorage.setItem("thyleads_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("thyleads_user");
    }
  }, [user, hydrated]);

  const router = useRouter();

  const setUser = useCallback((u: User) => {
    setUserState(u);
  }, []);

  async function login(email: string, password: string): Promise<string | null> {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsVerification) return "NEEDS_VERIFICATION";
        return data.error || "Login failed";
      }
      if (data.needsLoginOtp) return "NEEDS_LOGIN_OTP";
      setUserState(data.user);
      router.push("/");
      return null;
    } catch {
      return "Network error";
    }
  }

  async function loginWithGoogle(credential: string): Promise<string | null> {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Google login failed";
      setUserState(data.user);
      router.push("/");
      return null;
    } catch {
      return "Network error";
    }
  }

  function logout() {
    setUserState(null);
    router.push("/");
  }

  return (
    <AuthContext.Provider value={{ user, hydrated, login, loginWithGoogle, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
