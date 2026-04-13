"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { clientDetails as initialClientDetails, type ClientDetail } from "./client-data";
import { clientMetrics as initialClientMetrics, type DailyMetric, type ClientMetrics } from "./metrics-data";
import { useCrossTabSync } from "./use-sync";

export interface ClientProject {
  id: string;
  clientId: string;
  clientName: string;
  assignedPod: string;
  monthlyTargetExternal: number;
  weeklyTargetExternal: number;
  monthlyTargetInternal: number;
  targetsAchieved: number;
}

const defaultProjects: ClientProject[] = [
  { id: "p1", clientId: "CLT-1001", clientName: "Thyleads", assignedPod: "pod1", monthlyTargetExternal: 100, weeklyTargetExternal: 25, monthlyTargetInternal: 120, targetsAchieved: 95 },
  { id: "p2", clientId: "CLT-1002", clientName: "CleverTap- In", assignedPod: "pod1", monthlyTargetExternal: 80, weeklyTargetExternal: 20, monthlyTargetInternal: 90, targetsAchieved: 54 },
  { id: "p3", clientId: "CLT-1003", clientName: "BlueDove", assignedPod: "pod2", monthlyTargetExternal: 150, weeklyTargetExternal: 38, monthlyTargetInternal: 130, targetsAchieved: 110 },
  { id: "p4", clientId: "CLT-1004", clientName: "Evality", assignedPod: "pod2", monthlyTargetExternal: 60, weeklyTargetExternal: 15, monthlyTargetInternal: 70, targetsAchieved: 25 },
  { id: "p5", clientId: "CLT-1005", clientName: "Onecap", assignedPod: "pod3", monthlyTargetExternal: 110, weeklyTargetExternal: 28, monthlyTargetInternal: 95, targetsAchieved: 78 },
  { id: "p6", clientId: "CLT-1006", clientName: "Mynd", assignedPod: "pod3", monthlyTargetExternal: 90, weeklyTargetExternal: 22, monthlyTargetInternal: 75, targetsAchieved: 40 },
  { id: "p7", clientId: "CLT-1007", clientName: "Actyv", assignedPod: "pod4", monthlyTargetExternal: 200, weeklyTargetExternal: 50, monthlyTargetInternal: 160, targetsAchieved: 145 },
  { id: "p8", clientId: "CLT-1008", clientName: "Zigtal", assignedPod: "pod4", monthlyTargetExternal: 70, weeklyTargetExternal: 18, monthlyTargetInternal: 60, targetsAchieved: 15 },
  { id: "p9", clientId: "CLT-1009", clientName: "VWO", assignedPod: "pod1", monthlyTargetExternal: 120, weeklyTargetExternal: 30, monthlyTargetInternal: 100, targetsAchieved: 82 },
  { id: "p10", clientId: "CLT-1010", clientName: "Pazo", assignedPod: "pod2", monthlyTargetExternal: 95, weeklyTargetExternal: 24, monthlyTargetInternal: 110, targetsAchieved: 92 },
  { id: "p11", clientId: "CLT-1011", clientName: "Venwiz", assignedPod: "pod3", monthlyTargetExternal: 85, weeklyTargetExternal: 21, monthlyTargetInternal: 80, targetsAchieved: 68 },
  { id: "p12", clientId: "CLT-1012", clientName: "InFeedo", assignedPod: "pod4", monthlyTargetExternal: 130, weeklyTargetExternal: 32, monthlyTargetInternal: 140, targetsAchieved: 105 },
];

interface DataContextType {
  projects: ClientProject[];
  addProject: (project: ClientProject) => void;
  updateProject: (id: string, data: Partial<ClientProject>) => void;

  details: Record<string, ClientDetail[]>;
  addDetail: (projectId: string, detail: ClientDetail) => void;
  updateDetail: (projectId: string, detailId: string, data: Partial<ClientDetail>) => void;
  deleteDetail: (projectId: string, detailId: string) => void;

  metrics: Record<string, ClientMetrics[]>;
  addMetric: (projectId: string, date: string, month: string, year: number, leads: number, accounts: number) => void;
  updateMetric: (projectId: string, month: string, year: number, date: string, data: Partial<DailyMetric>) => void;
  deleteMetric: (projectId: string, month: string, year: number, date: string) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<ClientProject[]>(defaultProjects);
  const [details, setDetails] = useState<Record<string, ClientDetail[]>>(initialClientDetails);
  const [metrics, setMetrics] = useState<Record<string, ClientMetrics[]>>(initialClientMetrics);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const DATA_VERSION = "v6";
    try {
      if (localStorage.getItem("thyleads_data_version") !== DATA_VERSION) {
        localStorage.removeItem("thyleads_projects");
        localStorage.removeItem("thyleads_details");
        localStorage.removeItem("thyleads_metrics");
        localStorage.setItem("thyleads_data_version", DATA_VERSION);
      } else {
        const p = localStorage.getItem("thyleads_projects");
        const d = localStorage.getItem("thyleads_details");
        const m = localStorage.getItem("thyleads_metrics");
        if (p) setProjects(JSON.parse(p));
        if (d) setDetails(JSON.parse(d));
        if (m) setMetrics(JSON.parse(m));
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) localStorage.setItem("thyleads_projects", JSON.stringify(projects)); }, [projects, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("thyleads_details", JSON.stringify(details)); }, [details, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("thyleads_metrics", JSON.stringify(metrics)); }, [metrics, loaded]);

  const setProjectsCb = useCallback((v: ClientProject[]) => setProjects(v), []);
  const setDetailsCb = useCallback((v: Record<string, ClientDetail[]>) => setDetails(v), []);
  const setMetricsCb = useCallback((v: Record<string, ClientMetrics[]>) => setMetrics(v), []);
  useCrossTabSync("thyleads_projects", setProjectsCb);
  useCrossTabSync("thyleads_details", setDetailsCb);
  useCrossTabSync("thyleads_metrics", setMetricsCb);

  function addProject(project: ClientProject) {
    setProjects((prev) => [...prev, project]);
  }

  function updateProject(id: string, data: Partial<ClientProject>) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  }

  function addDetail(projectId: string, detail: ClientDetail) {
    setDetails((prev) => ({
      ...prev,
      [projectId]: [...(prev[projectId] ?? []), detail],
    }));
  }

  function updateDetail(projectId: string, detailId: string, data: Partial<ClientDetail>) {
    setDetails((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).map((d) => (d.id === detailId ? { ...d, ...data } : d)),
    }));
  }

  function deleteDetail(projectId: string, detailId: string) {
    setDetails((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).filter((d) => d.id !== detailId),
    }));
  }

  function addMetric(projectId: string, date: string, month: string, year: number, leads: number, accounts: number) {
    setMetrics((prev) => {
      const list = prev[projectId] ?? [];
      const existing = list.find((m) => m.month === month && m.year === year);
      if (existing) {
        return {
          ...prev,
          [projectId]: list.map((m) =>
            m.month === month && m.year === year
              ? { ...m, dailyMetrics: [...m.dailyMetrics, { date, leadsUploaded: leads, accountsMined: accounts }] }
              : m
          ),
        };
      }
      return {
        ...prev,
        [projectId]: [...list, { clientId: projectId, month, year, dailyMetrics: [{ date, leadsUploaded: leads, accountsMined: accounts }] }],
      };
    });
  }

  function updateMetric(projectId: string, month: string, year: number, date: string, data: Partial<DailyMetric>) {
    setMetrics((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).map((m) =>
        m.month === month && m.year === year
          ? { ...m, dailyMetrics: m.dailyMetrics.map((d) => (d.date === date ? { ...d, ...data } : d)) }
          : m
      ),
    }));
  }

  function deleteMetric(projectId: string, month: string, year: number, date: string) {
    setMetrics((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).map((m) =>
        m.month === month && m.year === year
          ? { ...m, dailyMetrics: m.dailyMetrics.filter((d) => d.date !== date) }
          : m
      ),
    }));
  }

  return (
    <DataContext.Provider value={{ projects, addProject, updateProject, details, addDetail, updateDetail, deleteDetail, metrics, addMetric, updateMetric, deleteMetric }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
