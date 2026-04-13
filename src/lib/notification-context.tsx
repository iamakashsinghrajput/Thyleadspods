"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

export interface Notification {
  id: string;
  message: string;
  timestamp: Date;
  read: boolean;
  forRole: "admin" | "pod";
  forPodId?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: (role: "admin" | "pod", podId?: string) => number;
  addNotification: (message: string, forRole: "admin" | "pod", forPodId?: string) => void;
  markAllRead: (role: "admin" | "pod", podId?: string) => void;
  clearAll: (role: "admin" | "pod", podId?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("thyleads_notifications");
      if (raw) {
        const parsed = JSON.parse(raw);
        setNotifications(parsed.map((n: Notification & { timestamp: string }) => ({ ...n, timestamp: new Date(n.timestamp) })));
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) localStorage.setItem("thyleads_notifications", JSON.stringify(notifications)); }, [notifications, loaded]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("/notification.wav");
    audioRef.current.volume = 1.0;
    if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "default") {
      window.Notification.requestPermission();
    }
  }, []);

  const playSound = useCallback((message?: string) => {
    try {
      if (audioRef.current) {
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
    let prevCount = notifications.length;
    function handleStorage(e: StorageEvent) {
      if (e.key !== "thyleads_notifications" || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        const incoming = parsed.map((n: Notification & { timestamp: string }) => ({ ...n, timestamp: new Date(n.timestamp) }));
        if (incoming.length > prevCount) {
          playSound();
        }
        prevCount = incoming.length;
        setNotifications(incoming);
      } catch {}
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [playSound, notifications.length]);

  const addNotification = useCallback((message: string, forRole: "admin" | "pod", forPodId?: string) => {
    const notif: Notification = {
      id: `n${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message,
      timestamp: new Date(),
      read: false,
      forRole,
      forPodId,
    };
    setNotifications((prev) => [notif, ...prev]);
    playSound();
  }, [playSound]);

  function unreadCount(role: "admin" | "pod", podId?: string) {
    return notifications.filter((n) => {
      if (n.read) return false;
      if (n.forRole !== role) return false;
      if (role === "pod" && n.forPodId && n.forPodId !== podId) return false;
      return true;
    }).length;
  }

  function markAllRead(role: "admin" | "pod", podId?: string) {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.forRole !== role) return n;
        if (role === "pod" && n.forPodId && n.forPodId !== podId) return n;
        return { ...n, read: true };
      })
    );
  }

  function clearAll(role: "admin" | "pod", podId?: string) {
    setNotifications((prev) =>
      prev.filter((n) => {
        if (n.forRole !== role) return true;
        if (role === "pod" && n.forPodId && n.forPodId !== podId) return true;
        return false;
      })
    );
  }

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
