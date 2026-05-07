// Returns [mondayISO, sundayISO] in YYYY-MM-DD for the current week (Mon-Sun).
export function getCurrentWeekRange(now: Date = new Date()): { start: string; end: string } {
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: toIso(monday), end: toIso(sunday) };
}

export function isInCurrentWeek(dateStr: string, now: Date = new Date()): boolean {
  if (!dateStr) return false;
  const { start, end } = getCurrentWeekRange(now);
  return dateStr >= start && dateStr <= end;
}
