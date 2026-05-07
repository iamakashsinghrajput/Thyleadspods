"use client";

import { useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useNotifications } from "@/lib/notification-context";

const AUTO_DISMISS_MS = 5_500;

export default function NotificationFlash() {
  const { flashes, dismissFlash } = useNotifications();

  useEffect(() => {
    const timers = flashes.map((f) =>
      setTimeout(() => dismissFlash(f.id), AUTO_DISMISS_MS),
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [flashes, dismissFlash]);

  if (flashes.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none w-full max-w-sm">
      {flashes.map((f) => (
        <div
          key={f.id}
          className="pointer-events-auto bg-linear-to-br from-[#6800FF] to-[#9B4DFF] text-white rounded-2xl shadow-2xl ring-4 ring-[#6800FF]/20 px-4 py-3 flex items-start gap-3 animate-flash-slide overflow-hidden"
        >
          <div className="shrink-0 mt-0.5 p-1.5 bg-white/15 rounded-lg">
            <Bell size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">New notification</p>
            <p className="text-sm font-semibold leading-snug mt-0.5 break-words">{f.message}</p>
          </div>
          <button
            onClick={() => dismissFlash(f.id)}
            className="shrink-0 p-1 rounded hover:bg-white/15 transition-colors text-white/80 hover:text-white"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <style jsx global>{`
        @keyframes flash-slide {
          0% { transform: translateX(120%); opacity: 0; }
          60% { transform: translateX(-8px); opacity: 1; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-flash-slide {
          animation: flash-slide 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
      `}</style>
    </div>
  );
}
