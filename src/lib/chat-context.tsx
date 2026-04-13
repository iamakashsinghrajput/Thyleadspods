"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./auth-context";

interface UnreadMap {
  [senderId: string]: number;
}

interface ChatContextType {
  unreadMap: UnreadMap;
  totalUnread: number;
  markRead: (senderId: string) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

const allUserIds = ["admin", "kunal", "rajesh", "mansi", "naman", "krishna", "mridul", "sandeep", "rashi"];

function getChatId(a: string, b: string) {
  return [a, b].sort().join("_");
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadMap, setUnreadMap] = useState<UnreadMap>({});
  const lastSeenRef = useRef<Record<string, string>>({});
  const prevCountRef = useRef(0);

  const myId = user?.name?.toLowerCase() ?? "";

  const playSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.value = 1.0;
      master.connect(ctx.destination);
      const notes = [
        { freq: 523, start: 0, dur: 0.18 },
        { freq: 659, start: 0.18, dur: 0.25 },
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
        gain.gain.setValueAtTime(1.0, ctx.currentTime + start + dur * 0.6);
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
        gain2.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc2.start(ctx.currentTime + start);
        osc2.stop(ctx.currentTime + start + dur);
      });
      setTimeout(() => ctx.close(), 800);
    } catch {}
  }, []);

  const checkUnread = useCallback(async () => {
    if (!myId) return;
    const others = allUserIds.filter((id) => id !== myId);
    const newMap: UnreadMap = {};

    await Promise.all(
      others.map(async (otherId) => {
        const chatId = getChatId(myId, otherId);
        const lastSeen = lastSeenRef.current[otherId] || "";
        const params = new URLSearchParams({ chatId });
        if (lastSeen) params.set("after", lastSeen);
        try {
          const res = await fetch(`/api/messages?${params}`);
          const data = await res.json();
          const fromOther = data.messages.filter((m: { sender: string }) => m.sender !== myId);
          if (fromOther.length > 0) {
            newMap[otherId] = (newMap[otherId] || 0) + fromOther.length;
          }
        } catch {}
      })
    );

    setUnreadMap((prev) => {
      const merged = { ...prev };
      for (const [k, v] of Object.entries(newMap)) {
        merged[k] = (merged[k] || 0) + v;
      }
      const newTotal = Object.values(merged).reduce((a, b) => a + b, 0);
      if (newTotal > prevCountRef.current) {
        playSound();
      }
      prevCountRef.current = newTotal;
      return merged;
    });

    for (const otherId of others) {
      const chatId = getChatId(myId, otherId);
      try {
        const res = await fetch(`/api/messages?${new URLSearchParams({ chatId })}`);
        const data = await res.json();
        if (data.messages.length > 0) {
          const lastMsg = data.messages[data.messages.length - 1];
          lastSeenRef.current[otherId] = lastMsg.createdAt;
        }
      } catch {}
    }
  }, [myId, playSound]);

  useEffect(() => {
    if (!myId) return;
    const stored = localStorage.getItem(`thyleads_chat_lastseen_${myId}`);
    if (stored) {
      try { lastSeenRef.current = JSON.parse(stored); } catch {}
    }
    checkUnread();
    const interval = setInterval(checkUnread, 3000);
    return () => clearInterval(interval);
  }, [myId, checkUnread]);

  function markRead(senderId: string) {
    setUnreadMap((prev) => {
      const next = { ...prev };
      delete next[senderId];
      prevCountRef.current = Object.values(next).reduce((a, b) => a + b, 0);
      return next;
    });
    const chatId = getChatId(myId, senderId);
    fetch(`/api/messages?${new URLSearchParams({ chatId })}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages.length > 0) {
          lastSeenRef.current[senderId] = data.messages[data.messages.length - 1].createdAt;
          localStorage.setItem(`thyleads_chat_lastseen_${myId}`, JSON.stringify(lastSeenRef.current));
        }
      })
      .catch(() => {});
  }

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  return (
    <ChatContext.Provider value={{ unreadMap, totalUnread, markRead }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
