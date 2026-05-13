"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./auth-context";

export interface PodInfo {
  id: string;
  name: string;
  members: string[];
  color: string;
  text: string;
  bgLight: string;
}

interface PodContextType {
  pods: PodInfo[];
  podMap: Record<string, PodInfo>;
  loaded: boolean;
  addPod: (name: string, members: string[]) => Promise<void>;
  deletePod: (id: string) => Promise<void>;
  updatePodMembers: (id: string, members: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

const PodContext = createContext<PodContextType | null>(null);

export function PodProvider({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useAuth();
  const [pods, setPods] = useState<PodInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch("/api/pods", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.pods)) {
        setPods((prev) => {
          const next = data.pods as PodInfo[];
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
          return next;
        });
        setLoaded(true);
      }
    } catch {} finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refresh();
  }, [hydrated, refresh]);

  useEffect(() => {
    if (!hydrated) return;
    const t = setInterval(() => { void refresh(); }, 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [hydrated, refresh]);

  const podMap = Object.fromEntries(pods.map((p) => [p.id, p])) as Record<string, PodInfo>;

  async function addPod(name: string, members: string[]) {
    if (!user?.email) return;
    const res = await fetch("/api/pods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: user.email, name, members }),
    });
    if (res.ok) {
      const { pod } = await res.json();
      if (pod) setPods((prev) => [...prev, pod]);
    }
  }

  async function deletePod(id: string) {
    if (!user?.email) return;
    setPods((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/pods?actor=${encodeURIComponent(user.email)}&id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    void refresh();
  }

  async function updatePodMembers(id: string, members: string[]) {
    if (!user?.email) return;
    setPods((prev) => prev.map((p) => p.id === id ? { ...p, members } : p));
    const res = await fetch("/api/pods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: user.email, id, members }),
    });
    if (!res.ok) void refresh();
  }

  return (
    <PodContext.Provider value={{ pods, podMap, loaded, addPod, deletePod, updatePodMembers, refresh }}>
      {children}
    </PodContext.Provider>
  );
}

export function usePods() {
  const ctx = useContext(PodContext);
  if (!ctx) throw new Error("usePods must be used within PodProvider");
  return ctx;
}
