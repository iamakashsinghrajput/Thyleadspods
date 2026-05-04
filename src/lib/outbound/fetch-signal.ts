export function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
  const valid = signals.filter((s): s is AbortSignal => s instanceof AbortSignal);
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return valid[0];
  const ctrl = new AbortController();
  const onAbort = (s: AbortSignal) => ctrl.abort(s.reason);
  for (const s of valid) {
    if (s.aborted) ctrl.abort(s.reason);
    else s.addEventListener("abort", () => onAbort(s), { once: true });
  }
  return ctrl.signal;
}

export function withTimeout(parent: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const t = AbortSignal.timeout(timeoutMs);
  const combined = combineSignals(parent, t);
  return combined as AbortSignal;
}

export const APOLLO_FETCH_TIMEOUT_MS = 25_000;
export const TAVILY_FETCH_TIMEOUT_MS = 25_000;
