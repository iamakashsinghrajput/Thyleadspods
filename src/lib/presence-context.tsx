"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./auth-context";

interface PresenceContextType {
  onlineUsers: Set<string>;
  isOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextType | null>(null);

const HEARTBEAT_INTERVAL = 15000;
const POLL_INTERVAL = 10000;

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const userId = user?.name?.toLowerCase().replace(/\s/g, "") ?? "";

  useEffect(() => {
    if (!userId || !user) return;
    const sendHeartbeat = () => {
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName: user.name }),
      }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [userId, user]);

  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const res = await fetch("/api/presence");
        const data = await res.json();
        setOnlineUsers(new Set(data.online || []));
      } catch {}
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const isOnline = useCallback((uid: string) => onlineUsers.has(uid), [onlineUsers]);

  return (
    <PresenceContext.Provider value={{ onlineUsers, isOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error("usePresence must be used within PresenceProvider");
  return ctx;
}
