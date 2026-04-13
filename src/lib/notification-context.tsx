"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

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

  const playSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      const master = ctx.createGain();
      master.gain.value = 1.0;
      master.connect(ctx.destination);

      const notes = [
        { freq: 587, start: 0, dur: 0.2 },
        { freq: 784, start: 0.2, dur: 0.2 },
        { freq: 880, start: 0.4, dur: 0.35 },
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(master);
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + start + 0.01);
        gain.gain.setValueAtTime(1.0, ctx.currentTime + start + dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(master);
        osc2.type = "sine";
        osc2.frequency.value = freq * 2;
        gain2.gain.setValueAtTime(0, ctx.currentTime + start);
        gain2.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.01);
        gain2.gain.setValueAtTime(0.4, ctx.currentTime + start + dur * 0.5);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc2.start(ctx.currentTime + start);
        osc2.stop(ctx.currentTime + start + dur);
      });

      setTimeout(() => ctx.close(), 1200);
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
