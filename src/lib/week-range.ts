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

export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function getWeeksInMonth(year: number, monthIndex: number): number {
  const daysInMonth = getDaysInMonth(year, monthIndex);
  const firstJsDay = new Date(year, monthIndex, 1).getDay();
  const monOffset = firstJsDay === 0 ? 6 : firstJsDay - 1;
  return Math.ceil((daysInMonth + monOffset) / 7);
}

export function getWeeklyTargetFromMonthly(monthlyTarget: number, now: Date = new Date()): number {
  if (monthlyTarget <= 0) return 0;
  const weeks = getWeeksInMonth(now.getFullYear(), now.getMonth());
  if (weeks <= 0) return 0;
  return Math.ceil(monthlyTarget / weeks);
}

export function getExpectedMeetingsToDate(monthlyTarget: number, now: Date = new Date()): number {
  if (monthlyTarget <= 0) return 0;
  const totalDays = getDaysInMonth(now.getFullYear(), now.getMonth());
  if (totalDays <= 0) return 0;
  const day = now.getDate();
  return Math.ceil((monthlyTarget * day) / totalDays);
}

export function getHealthPercent(completed: number, monthlyTarget: number, now: Date = new Date()): number {
  const expected = getExpectedMeetingsToDate(monthlyTarget, now);
  if (expected <= 0) return 0;
  return Math.round((completed / expected) * 100);
}
