"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { type ClientDetail } from "./client-data";
import { type DailyMetric, type ClientMetrics } from "./metrics-data";
import type { ClientProject } from "./data-types";
import { useAuth } from "./auth-context";
import { useNotifications } from "./notification-context";
import { usePods } from "./pod-context";

export type { ClientProject };

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

  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

const REFRESH_INTERVAL_MS = 15_000;

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { podMap } = usePods();
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [details, setDetails] = useState<Record<string, ClientDetail[]>>({});
  const [metrics, setMetrics] = useState<Record<string, ClientMetrics[]>>({});
  const seededRef = useRef(false);

  const isPod = user?.role === "pod";
  const actor = user?.name || "A pod member";
  const podLabel = (user?.podId && podMap[user.podId]?.name) || "";
  const notifyAdmins = useCallback((message: string) => {
    if (!isPod) return;
    addNotification(message, "admin");
  }, [isPod, addNotification]);
  const projectName = useCallback((projectId: string) => {
    return projects.find((p) => p.id === projectId)?.clientName || projectId;
  }, [projects]);

  const fetchAll = useCallback(async () => {
    const [pRes, dRes, mRes] = await Promise.all([
      fetch("/api/projects", { cache: "no-store" }),
      fetch("/api/details", { cache: "no-store" }),
      fetch("/api/metrics", { cache: "no-store" }),
    ]);
    const [pJson, dJson, mJson] = await Promise.all([pRes.json(), dRes.json(), mRes.json()]);
    setProjects(pJson.projects ?? []);
    setDetails(dJson.details ?? {});
    setMetrics(mJson.metrics ?? {});
    return (pJson.projects ?? []).length as number;
  }, []);

  const refresh = useCallback(async () => {
    await fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const count = await fetchAll();
      if (cancelled) return;
      if (count === 0 && !seededRef.current) {
        seededRef.current = true;
        await fetch("/api/seed-data", { method: "POST" });
        if (!cancelled) await fetchAll();
      }
    })();

    const interval = setInterval(() => {
      if (!document.hidden) void fetchAll();
    }, REFRESH_INTERVAL_MS);

    const onFocus = () => void fetchAll();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchAll]);

  function podPrefix() {
    return podLabel ? `${podLabel} (${actor})` : actor;
  }

  function addProject(project: ClientProject) {
    setProjects((prev) => [...prev, project]);
    void fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    }).then(() => fetchAll());
    notifyAdmins(`${podPrefix()} added a new client "${project.clientName}"`);
  }

  function updateProject(id: string, data: Partial<ClientProject>) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    void fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, data }),
    });
    notifyAdmins(`${podPrefix()} updated targets for ${projectName(id)}`);
  }

  function addDetail(projectId: string, detail: ClientDetail) {
    setDetails((prev) => ({ ...prev, [projectId]: [...(prev[projectId] ?? []), detail] }));
    void fetch("/api/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, detail }),
    });
    const contact = detail.contactName || detail.companyName || "a new contact";
    notifyAdmins(`${podPrefix()} added ${contact} to ${projectName(projectId)}`);
  }

  function updateDetail(projectId: string, detailId: string, data: Partial<ClientDetail>) {
    setDetails((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).map((d) => (d.id === detailId ? { ...d, ...data } : d)),
    }));
    void fetch("/api/details", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, detailId, data }),
    });
    const contact = data.contactName || details[projectId]?.find((d) => d.id === detailId)?.contactName || "a contact";
    notifyAdmins(`${podPrefix()} updated ${contact} for ${projectName(projectId)}`);
  }

  function deleteDetail(projectId: string, detailId: string) {
    const existing = details[projectId]?.find((d) => d.id === detailId);
    setDetails((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).filter((d) => d.id !== detailId),
    }));
    void fetch(`/api/details?projectId=${encodeURIComponent(projectId)}&detailId=${encodeURIComponent(detailId)}`, {
      method: "DELETE",
    });
    notifyAdmins(`${podPrefix()} deleted ${existing?.contactName || "a contact"} from ${projectName(projectId)}`);
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
    void fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, date, month, year, leads, accounts }),
    });
    notifyAdmins(`${podPrefix()} logged ${leads} leads / ${accounts} accounts on ${date} for ${projectName(projectId)}`);
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
    void fetch("/api/metrics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, month, year, date, data }),
    });
    notifyAdmins(`${podPrefix()} edited metrics for ${date} on ${projectName(projectId)}`);
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
    const qs = new URLSearchParams({ projectId, month, year: String(year), date });
    void fetch(`/api/metrics?${qs.toString()}`, { method: "DELETE" });
    notifyAdmins(`${podPrefix()} deleted metrics for ${date} on ${projectName(projectId)}`);
  }

  return (
    <DataContext.Provider value={{ projects, addProject, updateProject, details, addDetail, updateDetail, deleteDetail, metrics, addMetric, updateMetric, deleteMetric, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
