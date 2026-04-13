"use client";

import { useState, useEffect, useCallback } from "react";
import { X, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: "chat" | "notification";
  link?: string;
}

let addToastGlobal: ((toast: Omit<Toast, "id">) => void) | null = null;

export function showToast(toast: Omit<Toast, "id">) {
  addToastGlobal?.(toast);
}

export default function ToastBanner() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const router = useRouter();

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    addToastGlobal = addToast;
    return () => { addToastGlobal = null; };
  }, [addToast]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function handleClick(toast: Toast) {
    if (toast.link) router.push(toast.link);
    dismiss(toast.id);
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 animate-[slideIn_0.3s_ease-out] cursor-pointer hover:shadow-3xl transition-shadow"
          onClick={() => handleClick(toast)}
        >
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              toast.type === "chat" ? "bg-[#6800FF]/10" : "bg-amber-50"
            }`}>
              <MessageSquare size={16} className={toast.type === "chat" ? "text-[#6800FF]" : "text-amber-500"} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{toast.message}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(toast.id); }}
              className="p-1 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
