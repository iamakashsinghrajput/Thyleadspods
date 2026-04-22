"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAuth } from "./auth-context";

export interface Notification {
  id: string;
  message: string;
  timestamp: Date;
  read: boolean;
  forRole: "admin" | "pod" | "superadmin";
  forPodId?: string;
  forUserEmail?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: (role: "admin" | "pod", podId?: string) => number;
  addNotification: (message: string, forRole: "admin" | "pod" | "superadmin", forPodId?: string, forUserEmail?: string) => void;
  markAllRead: (role: "admin" | "pod", podId?: string) => void;
  clearAll: (role: "admin" | "pod", podId?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const POLL_MS = 15_000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(0);

  const email = (user?.email || "").toLowerCase();
  const role = user?.role || "";
  const podId = user?.podId || "";

  const playSound = useCallback((message?: string) => {
    try {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted" && document.hidden) {
        new window.Notification("Thyleads — Notification", {
          body: message || "You have a new notification",
          icon: "/logo.png",
          tag: "thyleads-notification",
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    audioRef.current = new Audio("/notification.mp3");
    audioRef.current.volume = 1.0;
    if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "default") {
      window.Notification.requestPermission();
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!email) return;
    try {
      const qs = new URLSearchParams({ role, podId, email });
      const res = await fetch(`/api/notifications?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();
      const incoming: Notification[] = (data.notifications || []).map((n: Notification & { timestamp: string }) => ({
        ...n,
        timestamp: new Date(n.timestamp),
      }));
      const prevIds = new Set<string>(notifications.map((n) => n.id));
      const newOnes = incoming.filter((n) => !prevIds.has(n.id));
      if (prevCountRef.current > 0 && newOnes.some((n) => !n.read)) {
        playSound(newOnes[0]?.message);
      }
      prevCountRef.current = incoming.length;
      setNotifications(incoming);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, role, podId, playSound]);

  useEffect(() => {
    if (!email) {
      setNotifications([]);
      prevCountRef.current = 0;
      return;
    }
    void fetchNotifications();
    const iv = setInterval(() => { if (!document.hidden) void fetchNotifications(); }, POLL_MS);
    const onFocus = () => void fetchNotifications();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [email, fetchNotifications]);

  const addNotification = useCallback((message: string, forRole: "admin" | "pod" | "superadmin", forPodId?: string, forUserEmail?: string) => {
    const optimistic: Notification = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message,
      timestamp: new Date(),
      read: false,
      forRole,
      forPodId,
      forUserEmail,
    };
    setNotifications((prev) => [optimistic, ...prev]);
    void fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forRole, forPodId: forPodId || "", forUserEmail: forUserEmail || "", message }),
    }).then(() => fetchNotifications());
  }, [fetchNotifications]);

  const unreadCount = useCallback((filterRole: "admin" | "pod", filterPodId?: string) => {
    return notifications.filter((n) => {
      if (n.read) return false;
      if (filterRole === "admin") {
        return n.forRole === "admin" || n.forRole === "superadmin";
      }
      if (filterRole === "pod") {
        if (n.forRole !== "pod") return false;
        if (n.forPodId && n.forPodId !== filterPodId) return false;
        return true;
      }
      return false;
    }).length;
  }, [notifications]);

  const markAllRead = useCallback((filterRole: "admin" | "pod", filterPodId?: string) => {
    if (!email) return;
    setNotifications((prev) => prev.map((n) => {
      if (filterRole === "admin" && (n.forRole === "admin" || n.forRole === "superadmin")) return { ...n, read: true };
      if (filterRole === "pod" && n.forRole === "pod" && (!n.forPodId || n.forPodId === filterPodId)) return { ...n, read: true };
      return n;
    }));
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, podId: filterPodId || podId, all: true }),
    });
  }, [email, role, podId]);

  const clearAll = useCallback((filterRole: "admin" | "pod", filterPodId?: string) => {
    if (!email) return;
    setNotifications((prev) => prev.filter((n) => {
      if (filterRole === "admin" && (n.forRole === "admin" || n.forRole === "superadmin")) return false;
      if (filterRole === "pod" && n.forRole === "pod" && (!n.forPodId || n.forPodId === filterPodId)) return false;
      return true;
    }));
    const qs = new URLSearchParams({ role, podId: filterPodId || podId, email });
    void fetch(`/api/notifications?${qs.toString()}`, { method: "DELETE" }).then(() => fetchNotifications());
  }, [email, role, podId, fetchNotifications]);

  const value = useMemo(() => ({ notifications, unreadCount, addNotification, markAllRead, clearAll }), [notifications, unreadCount, addNotification, markAllRead, clearAll]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
