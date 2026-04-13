"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notification-context";

export default function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  if (!user) return null;

  const role = user.role === "superadmin" ? "admin" : user.role;
  const podId = user.podId;
  const count = unreadCount(role, podId);

  const myNotifs = notifications.filter((n) => {
    if (n.forRole !== role) return false;
    if (role === "pod" && n.forPodId && n.forPodId !== podId) return false;
    return true;
  });

  const displayed = tab === "unread" ? myNotifs.filter((n) => !n.read) : myNotifs;

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen(!open);
  }

  function formatTime(date: Date) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  }

  function formatDate(date: Date) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function getDayLabel(date: Date) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[date.getDay()];
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-[#6800FF] text-white text-[10px] font-bold rounded-full">
            {count}
          </span>
        )}
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-[440px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            style={{ top: pos.top, right: pos.right }}
          >
            <div className="px-6 pt-5 pb-0">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-slate-900">Notifications</h3>
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-6 border-b border-slate-200">
                <button
                  onClick={() => setTab("all")}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    tab === "all" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  View all
                  {tab === "all" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />}
                </button>
                <button
                  onClick={() => setTab("unread")}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    tab === "unread" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Unread ({count})
                  {tab === "unread" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {displayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Bell size={32} className="mb-2 text-slate-200" />
                  <p className="text-sm font-medium">{tab === "unread" ? "All caught up!" : "No notifications yet"}</p>
                </div>
              ) : (
                displayed.map((n) => (
                  <div
                    key={n.id}
                    className="px-6 py-4 border-b border-slate-100 last:border-0 flex items-start gap-3.5 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${n.read ? "bg-slate-100 text-slate-400" : "bg-[#f0e6ff] text-[#6800FF]"}`}>
                        <Bell size={16} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] leading-relaxed ${n.read ? "text-slate-500" : "text-slate-800 font-medium"}`}>
                        {n.message}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-slate-400">{getDayLabel(n.timestamp)} {formatTime(n.timestamp)}</span>
                        <span className="text-xs text-slate-400">{formatDate(n.timestamp)}</span>
                      </div>
                    </div>
                    {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-[#6800FF] shrink-0 mt-1" />}
                  </div>
                ))
              )}
            </div>

            {myNotifs.length > 0 && (
              <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
                <button
                  onClick={() => markAllRead(role, podId)}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <Check size={16} />
                  Mark all as read
                </button>
                <button
                  onClick={() => { clearAll(role, podId); }}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
