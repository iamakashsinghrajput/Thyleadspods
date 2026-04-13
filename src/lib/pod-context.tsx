"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useCrossTabSync } from "./use-sync";

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
  addPod: (name: string, members: string[]) => void;
  deletePod: (id: string) => void;
  updatePodMembers: (id: string, members: string[]) => void;
}

const podColors = [
  { color: "bg-emerald-500", text: "text-emerald-700", bgLight: "bg-emerald-50" },
  { color: "bg-purple-500", text: "text-purple-700", bgLight: "bg-purple-50" },
  { color: "bg-orange-500", text: "text-orange-700", bgLight: "bg-orange-50" },
  { color: "bg-sky-500", text: "text-sky-700", bgLight: "bg-sky-50" },
  { color: "bg-rose-500", text: "text-rose-700", bgLight: "bg-rose-50" },
  { color: "bg-teal-500", text: "text-teal-700", bgLight: "bg-teal-50" },
  { color: "bg-amber-500", text: "text-amber-700", bgLight: "bg-amber-50" },
  { color: "bg-indigo-500", text: "text-indigo-700", bgLight: "bg-indigo-50" },
  { color: "bg-cyan-500", text: "text-cyan-700", bgLight: "bg-cyan-50" },
  { color: "bg-pink-500", text: "text-pink-700", bgLight: "bg-pink-50" },
];

const defaultPods: PodInfo[] = [
  { id: "pod1", name: "Pod 1", members: ["Kunal", "Rajesh"], ...podColors[0] },
  { id: "pod2", name: "Pod 2", members: ["Mansi", "Naman"], ...podColors[1] },
  { id: "pod3", name: "Pod 3", members: ["Krishna", "Mridul"], ...podColors[2] },
  { id: "pod4", name: "Pod 4", members: ["Sandeep", "Rashi"], ...podColors[3] },
];

const PodContext = createContext<PodContextType | null>(null);

export function PodProvider({ children }: { children: React.ReactNode }) {
  const [pods, setPods] = useState<PodInfo[]>(defaultPods);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("thyleads_pods");
      if (raw) setPods(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) localStorage.setItem("thyleads_pods", JSON.stringify(pods)); }, [pods, loaded]);

  const setPodsCb = useCallback((v: PodInfo[]) => setPods(v), []);
  useCrossTabSync("thyleads_pods", setPodsCb);

  const podMap = Object.fromEntries(pods.map((p) => [p.id, p])) as Record<string, PodInfo>;

  function addPod(name: string, members: string[]) {
    const nextNum = pods.length + 1;
    const colorSet = podColors[(pods.length) % podColors.length];
    const newPod: PodInfo = {
      id: `pod${nextNum}`,
      name,
      members,
      ...colorSet,
    };
    setPods((prev) => [...prev, newPod]);
  }

  function deletePod(id: string) {
    setPods((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePodMembers(id: string, members: string[]) {
    setPods((prev) => prev.map((p) => p.id === id ? { ...p, members } : p));
  }

  return (
    <PodContext.Provider value={{ pods, podMap, addPod, deletePod, updatePodMembers }}>
      {children}
    </PodContext.Provider>
  );
}

export function usePods() {
  const ctx = useContext(PodContext);
  if (!ctx) throw new Error("usePods must be used within PodProvider");
  return ctx;
}
