"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./auth-context";
import { allChatUserIds, allChatUsers, getUserId } from "./chat-users";
import { showToast } from "@/components/toast-banner";

interface PendingToast {
  senderName: string;
  count: number;
}

interface UnreadMap {
  [senderId: string]: number;
}

interface ChatContextType {
  unreadMap: UnreadMap;
  totalUnread: number;
  markRead: (senderId: string) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

function getChatId(a: string, b: string) {
  return [a, b].sort().join("_");
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadMap, setUnreadMap] = useState<UnreadMap>({});
  const lastSeenRef = useRef<Record<string, string>>({});
  const prevCountRef = useRef(0);
  const pendingToastRef = useRef<PendingToast | null>(null);
  const [toastTrigger, setToastTrigger] = useState(0);

  const myId = user ? getUserId(user.name) : "";

  useEffect(() => {
    if (toastTrigger === 0) return;
    const pending = pendingToastRef.current;
    if (pending) {
      showToast({
        title: pending.senderName,
        message: pending.count > 1 ? `Sent you ${pending.count} messages` : "Sent you a message",
        type: "chat",
        link: "/chat",
      });
      pendingToastRef.current = null;
    }
  }, [toastTrigger]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("/chat.mp3");
    audioRef.current.volume = 1.0;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const playSound = useCallback((senderName?: string) => {
    try {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      if (Notification.permission === "granted" && document.hidden) {
        new Notification("Thyleads — New Message", {
          body: senderName ? `${senderName} sent you a message` : "You have a new message",
          icon: "/logo.png",
          tag: "thyleads-chat",
        });
      }
    } catch {}
  }, []);

  const checkUnread = useCallback(async () => {
    if (!myId) return;
    const others = allChatUserIds.filter((id) => id !== myId);
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
      const newSenders: string[] = [];
      for (const [k, v] of Object.entries(newMap)) {
        const prevCount = prev[k] || 0;
        merged[k] = (merged[k] || 0) + v;
        if (merged[k] > prevCount) newSenders.push(k);
      }
      const newTotal = Object.values(merged).reduce((a, b) => a + b, 0);
      if (newTotal > prevCountRef.current) {
        const senderName = newSenders.length > 0
          ? (allChatUsers.find((u) => u.id === newSenders[0])?.name || newSenders[0])
          : undefined;
        playSound(senderName);
        if (senderName) {
          const count = newSenders.reduce((s, id) => s + ((newMap[id] || 0) - (prev[id] || 0)), 0);
          pendingToastRef.current = { senderName, count };
          setToastTrigger((t) => t + 1);
        }
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
