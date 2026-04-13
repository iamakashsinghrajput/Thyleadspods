"use client";

import { useEffect } from "react";

export function useCrossTabSync<T>(
  key: string,
  setState: (val: T) => void,
  transform?: (raw: T) => T
) {
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key !== key || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        setState(transform ? transform(parsed) : parsed);
      } catch {}
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, setState, transform]);
}
