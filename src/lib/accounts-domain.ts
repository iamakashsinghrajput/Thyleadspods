export function normalizeDomain(input: string): string {
  let d = (input || "").trim().toLowerCase();
  if (!d) return "";
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0];
  d = d.split("?")[0];
  d = d.split("#")[0];
  d = d.replace(/^www\./, "");
  d = d.replace(/[.,;]+$/, "");
  return d;
}

export function rootKeyFor(domain: string): string {
  const d = normalizeDomain(domain);
  if (!d) return "";
  const first = d.split(".")[0];
  return first || d;
}

const DNC_NEGATIVES = new Set([
  "n", "no", "false", "0", "-", "—", "–", "na", "n/a", "none", "null", "off", "active", "ok",
]);

export function parseDncFlag(value: unknown): boolean {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === "number") return value !== 0;
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return false;
  if (DNC_NEGATIVES.has(s)) return false;
  return true;
}
