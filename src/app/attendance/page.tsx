"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Maximize2,
  ClipboardList,
  ArrowUpRight,
  ArrowRight,
  Calendar as CalendarIcon,
  RefreshCw,
  Home,
  Send,
  FileText,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Video,
  ExternalLink,
  MapPin,
  Users,
  Loader2,
  LinkIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getUserId } from "@/lib/chat-users";

interface RegRequest {
  _id: string;
  userId: string;
  userName: string;
  date: string;
  punchIn: string;
  punchOut: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

interface LeaveRequest {
  _id: string;
  userId: string;
  userName: string;
  leaveDate: string;
  leaveType: string;
  subject: string;
  body: string;
  status: "pending" | "approved" | "denied";
  adminNote: string;
  createdAt: string;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  location: string;
  meetLink: string;
  htmlLink: string;
  attendees: { email: string; name: string; responseStatus: string }[];
}

function fmtMeetTime(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function isMeetingNow(start: string, end: string) {
  const now = Date.now();
  return new Date(start).getTime() <= now && new Date(end).getTime() >= now;
}

function getMeetDuration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

const LEAVE_TYPES = [
  { value: "Sick Leave", icon: "🤒", desc: "Illness or health-related absence" },
  { value: "Casual Leave", icon: "🏖️", desc: "Personal work or short absence" },
  { value: "Earned Leave", icon: "📅", desc: "Pre-planned earned/privilege leave" },
  { value: "Personal Leave", icon: "🏠", desc: "Personal matters or errands" },
  { value: "Family Emergency", icon: "👨‍👩‍👧", desc: "Urgent family situation" },
  { value: "Medical Appointment", icon: "🏥", desc: "Doctor visit or medical procedure" },
  { value: "Bereavement Leave", icon: "🕊️", desc: "Loss of a family member" },
  { value: "Other", icon: "📝", desc: "Any other reason" },
];

interface AttendanceRecord {
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  totalMinutes: number;
  status: string;
  rePunchIn?: boolean;
  rePunchLog?: string;
  prevMinutes?: number;
  rePunchCount?: number;
}

const HOLIDAYS = [
  { date: "2026-01-15", day: "Thursday", name: "Makara Sankranti" },
  { date: "2026-01-26", day: "Monday", name: "Republic Day" },
  { date: "2026-03-19", day: "Thursday", name: "Ugadi" },
  { date: "2026-03-21", day: "Saturday", name: "Maha Shivaratri" },
  { date: "2026-05-01", day: "Friday", name: "May Day (Labour Day)" },
  { date: "2026-05-28", day: "Thursday", name: "Bakrid (Eid-ul-Adha)" },
  { date: "2026-08-15", day: "Saturday", name: "Independence Day" },
  { date: "2026-09-14", day: "Monday", name: "Ganesh Chaturthi" },
  { date: "2026-10-02", day: "Friday", name: "Gandhi Jayanti" },
  { date: "2026-10-21", day: "Wednesday", name: "Vijayadashami (Dussehra)" },
  { date: "2026-11-10", day: "Tuesday", name: "Deepavali" },
  { date: "2026-11-27", day: "Friday", name: "Kanakadasa Jayanti" },
  { date: "2026-12-25", day: "Friday", name: "Christmas" },
];

function getNextHoliday() {
  const today = new Date().toISOString().split("T")[0];
  return HOLIDAYS.find((h) => h.date >= today) || HOLIDAYS[0];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const totalDays = last.getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(i);
  return days;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [calMonth] = useState(new Date().getMonth());
  const [calYear] = useState(new Date().getFullYear());
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [tick, setTick] = useState(0);
  const [showHolidays, setShowHolidays] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [attendanceFlipped, setAttendanceFlipped] = useState(false);
  const [calExpanded, setCalExpanded] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showRegForm, setShowRegForm] = useState(false);
  const [regForm, setRegForm] = useState({ punchIn: "", punchOut: "", reason: "" });
  const [regRequests, setRegRequests] = useState<RegRequest[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [adminRequests, setAdminRequests] = useState<RegRequest[]>([]);
  const [showLeavePopup, setShowLeavePopup] = useState(false);
  const [leaveStep, setLeaveStep] = useState<"select" | "application">("select");
  const [leaveType, setLeaveType] = useState("");
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
  const [adminLeaveRequests, setAdminLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveAdminNote, setLeaveAdminNote] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [showMeetingsPopup, setShowMeetingsPopup] = useState(false);
  const [calendarConnecting, setCalendarConnecting] = useState(false);

  const nextHoliday = getNextHoliday();
  const userId = user ? getUserId(user.name) : "";
  const todayDate = new Date().toISOString().split("T")[0];

  const fetchToday = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/attendance?userId=${userId}&date=${todayDate}`);
      const data = await res.json();
      setToday(data.record);
    } catch {}
  }, [userId, todayDate]);

  const fetchMonth = useCallback(async () => {
    if (!userId) return;
    try {
      const m = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
      const res = await fetch(`/api/attendance?userId=${userId}&month=${m}`);
      const data = await res.json();
      setMonthRecords(data.records || []);
    } catch {}
  }, [userId, calMonth, calYear]);

  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchToday(); })();
    return () => { ignore = true; };
  }, [fetchToday]);
  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchMonth(); })();
    return () => { ignore = true; };
  }, [fetchMonth]);

  useEffect(() => {
    if (!today?.punchIn || today?.punchOut) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [today]);

  async function handlePunch(action: "punchIn" | "punchOut") {
    if (!user) return;
    setLoading(true);
    try {
      await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName: user.name, action }),
      });
      await fetchToday();
      await fetchMonth();
    } catch {}
    setLoading(false);
  }

  const fetchRegRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/regularize?userId=${userId}`);
      const data = await res.json();
      setRegRequests(data.records || []);
    } catch {}
  }, [userId]);

  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchRegRequests(); })();
    return () => { ignore = true; };
  }, [fetchRegRequests]);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const fetchAdminRequests = useCallback(async () => {
    if (!isAdmin || !userId) return;
    try {
      const res = await fetch(`/api/regularize?all=true&status=pending&approverId=${userId}`);
      const data = await res.json();
      setAdminRequests(data.records || []);
    } catch {}
  }, [isAdmin, userId]);

  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchAdminRequests(); })();
    return () => { ignore = true; };
  }, [fetchAdminRequests]);

  const fetchMyLeaveRequests = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/leave?userId=${userId}`);
      const data = await res.json();
      setMyLeaveRequests(data.records || []);
    } catch {}
  }, [userId]);

  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchMyLeaveRequests(); })();
    return () => { ignore = true; };
  }, [fetchMyLeaveRequests]);

  const fetchAdminLeaveRequests = useCallback(async () => {
    if (!isAdmin || !userId) return;
    try {
      const res = await fetch(`/api/leave?all=true&status=pending&approverId=${userId}`);
      const data = await res.json();
      setAdminLeaveRequests(data.records || []);
    } catch {}
  }, [isAdmin, userId]);

  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchAdminLeaveRequests(); })();
    return () => { ignore = true; };
  }, [fetchAdminLeaveRequests]);

  const fetchCalendarEvents = useCallback(async () => {
    if (!userId) return;
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      const res = await fetch(`/api/calendar/events?userId=${userId}&timeMin=${startOfDay.toISOString()}&timeMax=${endOfDay.toISOString()}`);
      const data = await res.json();
      if (data.connected === false) {
        setCalendarConnected(false);
      } else {
        setCalendarConnected(true);
        setCalendarEvents(data.events || []);
      }
    } catch {
      setCalendarConnected(false);
    }
  }, [userId]);

  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchCalendarEvents(); })();
    return () => { ignore = true; };
  }, [fetchCalendarEvents]);

  async function connectCalendar() {
    setCalendarConnecting(true);
    try {
      const res = await fetch("/api/calendar/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setCalendarConnecting(false);
  }

  const upcomingMeetings = calendarEvents.filter((e) => new Date(e.end).getTime() > now);
  const nextMeeting = upcomingMeetings[0] || null;

  async function handleLeaveAction(requestId: string, action: "approve" | "deny") {
    await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, requestId, adminNote: leaveAdminNote }),
    });
    setLeaveAdminNote("");
    await fetchAdminLeaveRequests();
    await fetchMonth();
  }

  async function submitLeaveApplication() {
    if (!user || !leaveType || !leaveDate) return;
    setLeaveLoading(true);
    const subject = `Application for ${leaveType} on ${new Date(leaveDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`;
    const approverName = user.approverId ? user.approverId.charAt(0).toUpperCase() + user.approverId.slice(1) : "Admin";
    const appBody = `Dear ${approverName},\n\nI am writing to formally request ${leaveType.toLowerCase()} on ${new Date(leaveDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.\n\nLeave Type: ${leaveType}\nDate: ${leaveDate}\n\nI kindly request you to approve my leave application.\n\nThank you.\n\nRegards,\n${user.name}`;
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          userId,
          userName: user.name,
          leaveDate,
          leaveType,
          subject,
          body: appBody,
          approverId: user.approverId,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setShowLeavePopup(false);
        setLeaveStep("select");
        setLeaveType("");
        setLeaveDate(new Date().toISOString().split("T")[0]);
        await fetchMyLeaveRequests();
      }
    } catch {}
    setLeaveLoading(false);
  }

  async function handleRegAction(requestId: string, action: "approve" | "reject") {
    await fetch("/api/regularize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, requestId }),
    });
    await fetchAdminRequests();
  }

  async function submitRegularize() {
    if (!user || !selectedDay || !regForm.punchIn || !regForm.punchOut || !regForm.reason) return;
    setRegLoading(true);
    try {
      await fetch("/api/regularize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", userId, userName: user.name, date: selectedDay, ...regForm, approverId: user.approverId }),
      });
      setShowRegForm(false);
      setRegForm({ punchIn: "", punchOut: "", reason: "" });
      setSelectedDay(null);
      await fetchRegRequests();
    } catch {}
    setRegLoading(false);
  }

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!today?.punchIn || today?.punchOut) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [today]);

  if (!user) return null;

  const isPunchedIn = !!(today?.punchIn && !today?.punchOut);
  const isPunchedOut = !!(today?.punchIn && today?.punchOut);

  const currentHour = new Date().getHours();
  const currentMin = new Date().getMinutes();
  const currentTimeMin = currentHour * 60 + currentMin;
  const punchAllowedFrom = 9 * 60 + 30;
  const punchAllowedUntil = 19 * 60;
  const isPunchTimeAllowed = currentTimeMin >= punchAllowedFrom && currentTimeMin <= punchAllowedUntil;

  function to12h(t: string) {
    if (!t || t.includes("AM") || t.includes("PM")) return t;
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  const elapsedSeconds = (() => {
    void tick;
    if (!today?.punchIn || today?.punchOut) return (today?.totalMinutes || 0) * 60;
    const inTime = new Date(`${todayDate}T${today.punchIn}:00`).getTime();
    if (isNaN(inTime)) return 0;
    const currentSession = Math.max(0, Math.floor((now - inTime) / 1000));
    const prevSecs = (today.prevMinutes || 0) * 60;
    return prevSecs + currentSession;
  })();

  const liveH = Math.floor(elapsedSeconds / 3600);
  const liveM = Math.floor((elapsedSeconds % 3600) / 60);
  const liveS = elapsedSeconds % 60;
  const liveStr = `${String(liveH).padStart(2, "0")}:${String(liveM).padStart(2, "0")}:${String(liveS).padStart(2, "0")}`;
  const livePct = Math.min((elapsedSeconds / 32400) * 100, 100);

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const angle = (livePct / 100) * 2 * Math.PI - Math.PI / 2;
  const knobX = 50 + radius * Math.cos(angle);
  const knobY = 50 + radius * Math.sin(angle);

  const calDays = getMonthDays(calYear, calMonth);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const attendanceDates = new Set(monthRecords.map((r) => r.date));
  const todayNum = new Date().getDate();
  const leavesTaken = monthRecords.filter((r) => r.status === "leave").length;
  const wfhDays = monthRecords.filter((r) => (r as AttendanceRecord & { isWfh?: boolean }).isWfh).length;

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-4 lg:p-6 font-sans text-slate-900">
      <div className="max-w-350 mx-auto flex flex-col lg:flex-row gap-4">

        <div className="w-full lg:w-95 shrink-0 self-stretch" style={{ perspective: "1200px" }}>
          <div className="relative w-full h-full transition-transform duration-600" style={{ transformStyle: "preserve-3d", transform: attendanceFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>

          <div className="bg-white rounded-4xl p-8 shadow-sm relative flex flex-col items-center h-full" style={{ backfaceVisibility: "hidden" }}>
          <button onClick={() => setAttendanceFlipped(true)} className="absolute top-5 right-5 flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#6800FF] transition-colors group">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium">View Report</span>
            <RefreshCw size={15} />
          </button>

          <h2 className="text-2xl font-bold mt-2 mb-10 text-slate-900">Attendance</h2>

          <div className="relative w-64 h-64 mb-10">
            <svg className="w-full h-full drop-shadow-sm" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="#09090b" strokeWidth="8" />
              <circle cx="50" cy="50" r={radius} fill="none" stroke="#6800FF" strokeWidth="8" strokeDasharray={`${(livePct / 100) * circumference} ${circumference}`} strokeLinecap="round" className="transition-all duration-1000 ease-out" transform="rotate(-90 50 50)" />
              <circle cx={knobX} cy={knobY} r="5" fill="#6800FF" stroke="#ffffff" strokeWidth="2.5" className="transition-all duration-1000 ease-out drop-shadow-md" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
              <p className="text-[2rem] font-medium text-slate-900 tabular-nums tracking-tight">{liveStr}</p>
              <p className="text-sm text-slate-500 font-medium">Working Hours</p>
            </div>
          </div>

          <div className="w-full bg-[#09090b] rounded-[1.25rem] p-5 flex items-center justify-between mb-8 shadow-lg shadow-black/10">
            <div className="text-left">
              <p className="text-xs text-slate-400 font-medium mb-1">Punch in</p>
              <p className="text-lg text-white tabular-nums font-medium tracking-wide">{today?.punchIn ? to12h(today.punchIn) : "--:--"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-medium mb-1">Punch out</p>
              <p className="text-lg text-white tabular-nums font-medium tracking-wide">{today?.punchOut ? to12h(today.punchOut) : "00:00"}</p>
            </div>
          </div>

          {isPunchedOut ? (
            <div className="w-full space-y-3">
              <div className="w-full py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold rounded-full text-center text-sm">
                Day Complete — {Math.floor(today!.totalMinutes / 60)}h {today!.totalMinutes % 60}m
              </div>
              {isPunchTimeAllowed && (today?.rePunchCount || 0) < 2 && (
                <button
                  onClick={() => handlePunch("punchIn")}
                  disabled={loading}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-100 text-slate-700 font-semibold text-sm rounded-full transition-all border border-slate-200"
                >
                  {loading ? "Processing..." : `Re-Punch In (${2 - (today?.rePunchCount || 0)} left)`}
                </button>
              )}
              {(today?.rePunchCount || 0) >= 2 && (
                <p className="text-xs text-slate-400 text-center">Re-punch limit reached (2/day)</p>
              )}
            </div>
          ) : !isPunchTimeAllowed && !isPunchedIn ? (
            <div className="w-full py-4 bg-slate-100 text-slate-400 font-semibold text-sm rounded-full text-center">
              Punch available 9:30 AM – 7:00 PM
            </div>
          ) : (
            <button
              onClick={() => handlePunch(isPunchedIn ? "punchOut" : "punchIn")}
              disabled={loading}
              className="w-full py-4 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white font-semibold text-lg rounded-full transition-all shadow-[0_8px_20px_-6px_rgba(249,115,22,0.5)] mt-auto"
            >
              {loading ? "Processing..." : isPunchedIn ? "Punch out" : "Punch in"}
            </button>
          )}
          </div>

          <div className="bg-white rounded-4xl p-6 shadow-sm absolute inset-0 flex flex-col overflow-hidden" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Attendance Report</h2>
              <button onClick={() => setAttendanceFlipped(false)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-900 transition-colors group">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium">Back to Timer</span>
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {monthRecords.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No records this month</p>}
              {[...monthRecords].reverse().map((r) => {
                const d = new Date(r.date);
                const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                const hrs = Math.floor(r.totalMinutes / 60);
                const mins = r.totalMinutes % 60;
                return (
                  <div key={r.date} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        r.status === "present" ? "bg-emerald-500" :
                        r.status === "half-day" ? "bg-amber-500" :
                        r.status === "leave" ? "bg-red-400" : "bg-slate-300"
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{dayLabel}</p>
                        <p className="text-[11px] text-slate-400">
                          {r.status === "leave" ? "On Leave" : `${r.punchIn ? to12h(r.punchIn) : "--"} → ${r.punchOut ? to12h(r.punchOut) : "active"}`}
                          {(r as AttendanceRecord & { isWfh?: boolean }).isWfh && <span className="ml-1 text-[#6800FF] font-semibold">WFH</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.status === "present" ? "bg-emerald-50 text-emerald-700" :
                        r.status === "half-day" ? "bg-amber-50 text-amber-700" :
                        r.status === "leave" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
                      }`}>{r.status}</span>
                      {r.totalMinutes > 0 && <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{hrs}h {mins}m</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pt-3 mt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-emerald-600 tabular-nums">{monthRecords.filter((r) => r.status === "present").length}</p>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Present</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-500 tabular-nums">{leavesTaken}</p>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Leaves</p>
              </div>
              <div>
                <p className="text-lg font-bold text-[#6800FF] tabular-nums">{wfhDays}</p>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">WFH</p>
              </div>
            </div>
          </div>

          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-white rounded-4xl px-8 py-5 shadow-sm relative overflow-hidden flex items-center">
              <div className="relative z-10">
                <p className="text-lg text-slate-500 font-medium">Hi, {user.name}</p>
                <h1 className="text-4xl font-bold text-slate-900 leading-tight">{getGreeting()}</h1>
                <p className="text-slate-400 text-base mt-1">Have a good day</p>
              </div>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden sm:block pointer-events-none">
                <div className="relative w-36 h-36">
                  <svg viewBox="0 0 200 200" className="w-full h-full opacity-90">
                    <path d="M60 20 L140 20 L140 40 L110 90 L140 140 L140 180 L60 180 L60 140 L90 90 L60 40 Z" fill="#fff" stroke="#1e293b" strokeWidth="4" />
                    <path d="M60 20 L140 20 L140 40 Q100 110 60 40 Z" fill="#fbd38d" />
                    <path d="M60 180 L140 180 L140 140 Q100 80 60 140 Z" fill="#6800FF" />
                    <circle cx="160" cy="120" r="15" fill="#6800FF" />
                    <rect x="155" y="115" width="10" height="10" fill="#fff" rx="2" />
                    <path d="M40 160 Q30 140 20 170" stroke="#6800FF" strokeWidth="3" fill="none" />
                    <rect x="20" y="50" width="30" height="20" rx="4" fill="#e2e8f0" />
                    <rect x="160" y="40" width="20" height="30" rx="4" fill="#e2e8f0" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="md:col-span-1 bg-white rounded-4xl p-4 shadow-sm relative flex flex-col">
              <button onClick={() => setCalExpanded(true)} className="absolute top-3 right-3 flex items-center gap-1 text-slate-400 hover:text-[#6800FF] transition-colors group">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium">Regularize</span>
                <Maximize2 size={14} />
              </button>
              <h3 className="text-base font-bold text-center mb-0.5">Calendar</h3>
              <p className="text-xs font-semibold text-center text-slate-700 mb-2">{monthNames[calMonth]}</p>
              <div className="grid grid-cols-7 gap-y-2 gap-x-1 mb-1 px-2">
                {DAYS.map((d) => <div key={d} className="text-center text-[10px] font-bold text-slate-500">{d.substring(0, 3)}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-y-1 gap-x-1 px-2">
                {calDays.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const hasRecord = attendanceDates.has(dateStr);
                  const isToday = day === todayNum;
                  const isPast = !isToday && dateStr < todayDate && !hasRecord;
                  const regReq = regRequests.find((r) => r.date === dateStr);
                  return (
                    <div key={i} className="flex justify-center items-center aspect-square">
                      <button
                        onClick={() => { if (isPast || hasRecord) { setSelectedDay(dateStr); setCalExpanded(true); } }}
                        className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold transition-all ${
                          selectedDay === dateStr ? "ring-2 ring-[#6800FF] ring-offset-1" :
                          isToday ? "bg-[#6800FF] text-white shadow-sm" :
                          hasRecord ? "border border-[#09090b] text-slate-900" :
                          regReq?.status === "pending" ? "bg-amber-100 text-amber-700" :
                          isPast ? "text-red-300" :
                          "text-slate-700"
                        }`}
                      >{day}</button>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
            <div className="md:col-span-2 flex flex-col">
              <h2 className="text-lg font-bold text-slate-900 mb-3 px-1">Quick status</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                {[
                  { icon: ClipboardList, title: "Project", desc: "Lorem ipsum dolor sit amet, consectetur.", extra: null },
                  { icon: ArrowUpRight, title: "Leave", desc: null, extra: (() => {
                    const latest = myLeaveRequests[0];
                    if (!latest) return <p className="text-sm text-slate-400">No leave requests</p>;
                    return (
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{latest.leaveType}</p>
                        <p className={`text-sm font-bold ${latest.status === "approved" ? "text-emerald-500" : latest.status === "denied" ? "text-red-500" : "text-amber-500"}`}>
                          {latest.status === "approved" ? "Approved" : latest.status === "denied" ? "Denied" : "Pending"}
                        </p>
                      </div>
                    );
                  })(), onClick: () => { setShowLeavePopup(true); setLeaveStep("select"); setLeaveType(""); } },
                  { icon: ArrowRight, title: "Holiday", desc: null, extra: <><p className="text-sm font-semibold text-[#6800FF] mb-0.5">{nextHoliday.date.split("-")[2]} {nextHoliday.name}</p><p className="text-sm font-semibold text-slate-900">{nextHoliday.day}</p></>, onClick: () => setShowHolidays(true) },
                  { icon: Video, title: "Meeting", desc: null, extra: (() => {
                    if (calendarConnected === false) return <p className="text-sm text-slate-400">Connect calendar</p>;
                    if (!nextMeeting) return <p className="text-sm text-slate-400">No meetings today</p>;
                    const live = isMeetingNow(nextMeeting.start, nextMeeting.end);
                    return (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 truncate max-w-45">{nextMeeting.summary}</p>
                        <p className={`text-sm font-bold ${live ? "text-emerald-500" : "text-[#6800FF]"}`}>
                          {live ? "Live Now" : fmtMeetTime(nextMeeting.start)}
                        </p>
                      </div>
                    );
                  })(), onClick: () => setShowMeetingsPopup(true) },
                ].map((card) => {
                  const Icon = card.icon;
                  const onClick = "onClick" in card ? (card as { onClick: () => void }).onClick : undefined;
                  return (
                    <div key={card.title} onClick={onClick} className={`bg-white rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-center ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 flex items-center justify-center opacity-30 pointer-events-none">
                        <div className="w-32 h-32 rounded-full border-16 border-orange-100 flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full border-16 border-orange-200 flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-orange-300" />
                          </div>
                        </div>
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon size={18} className="text-slate-900" />
                          <h4 className="text-lg font-bold text-slate-900">{card.title}</h4>
                        </div>
                        {card.desc && <p className="text-sm text-slate-600 font-medium max-w-45 leading-relaxed">{card.desc}</p>}
                        {card.extra}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-1 mt-11.5" style={{ perspective: "1000px" }}>
              <div
                className="relative w-full transition-transform duration-500"
                style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                <div className="bg-white rounded-4xl p-8 shadow-sm flex flex-col items-center relative" style={{ backfaceVisibility: "hidden" }}>
                  <button onClick={() => setFlipped(true)} className="absolute top-4 right-4 flex items-center gap-1 text-slate-400 hover:text-[#6800FF] transition-colors group">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium">WFH Stats</span>
                    <RefreshCw size={14} />
                  </button>
                  <h3 className="text-xl font-bold text-slate-900 mb-6">Leave Stats</h3>
                  <div className="relative w-36 h-36 mb-4">
                    <svg className="w-full h-full drop-shadow-sm" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#09090b" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#6800FF" strokeWidth="8" strokeDasharray={`${Math.min(leavesTaken / Math.max(leavesTaken, 1), 1) * (2 * Math.PI * 42)} ${2 * Math.PI * 42}`} strokeLinecap="round" transform="rotate(-90 50 50)" className="transition-all duration-700" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
                      <span className="text-4xl font-medium text-slate-900 tracking-tight">{leavesTaken}</span>
                      <span className="text-base text-slate-500 font-medium">Days</span>
                    </div>
                  </div>
                  <p className="text-2xl font-medium text-slate-900 mb-6">{leavesTaken} <span className="text-sm text-slate-400">days</span></p>
                  <button
                    onClick={() => { setShowLeavePopup(true); setLeaveStep("select"); setLeaveType(""); }}
                    className="w-full py-3 bg-[#6800FF] hover:bg-[#5800DD] text-white font-semibold rounded-full transition-colors mt-auto"
                  >
                    Apply for leave
                  </button>
                </div>

                <div className="bg-white rounded-4xl p-8 shadow-sm flex flex-col items-center absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <button onClick={() => setFlipped(false)} className="absolute top-4 right-4 flex items-center gap-1 text-slate-400 hover:text-[#6800FF] transition-colors group">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium">Leave Stats</span>
                    <RefreshCw size={14} />
                  </button>
                  <h3 className="text-xl font-bold text-slate-900 mb-6">WFH Stats</h3>
                  <div className="relative w-36 h-36 mb-4">
                    <svg className="w-full h-full drop-shadow-sm" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#09090b" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#6366f1" strokeWidth="8" strokeDasharray={`${Math.min(wfhDays / Math.max(wfhDays, 1), 1) * (2 * Math.PI * 42)} ${2 * Math.PI * 42}`} strokeLinecap="round" transform="rotate(-90 50 50)" className="transition-all duration-700" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
                      <span className="text-4xl font-medium text-slate-900 tracking-tight">{wfhDays}</span>
                      <span className="text-base text-slate-500 font-medium">Days</span>
                    </div>
                  </div>
                  <p className="text-2xl font-medium text-slate-900 mb-2">{wfhDays} <span className="text-sm text-slate-400">days</span></p>
                  <p className="text-xs text-slate-400 mb-6">WFH days this month</p>
                  <button
                    onClick={async () => {
                      await fetch("/api/attendance", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId, userName: user!.name, action: "markWfh" }),
                      });
                      fetchToday();
                      fetchMonth();
                    }}
                    className="w-full py-3 bg-[#6800FF] hover:bg-[#5800DD] text-white font-semibold rounded-full transition-colors mt-auto flex items-center justify-center gap-2"
                  >
                    <Home size={16} /> Mark WFH Today
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {calExpanded && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => { setCalExpanded(false); setSelectedDay(null); setShowRegForm(false); }} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Attendance Calendar</h3>
                <p className="text-xs text-slate-400 mt-0.5">{monthNames[calMonth]} {calYear} — Click a day to view details or regularize</p>
              </div>
              <button onClick={() => { setCalExpanded(false); setSelectedDay(null); setShowRegForm(false); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-xl leading-none">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="grid grid-cols-7 gap-y-2 gap-x-2 mb-2">
                    {DAYS.map((d) => <div key={d} className="text-center text-xs font-bold text-slate-400">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-y-2 gap-x-2">
                    {calDays.map((day, i) => {
                      if (day === null) return <div key={`e-${i}`} />;
                      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const hasRecord = attendanceDates.has(dateStr);
                      const isToday = day === todayNum;
                      const isPast = !isToday && dateStr < todayDate && !hasRecord;
                      const regReq = regRequests.find((r) => r.date === dateStr);
                      const isSelected = selectedDay === dateStr;
                      return (
                        <div key={i} className="flex justify-center">
                          <button
                            onClick={() => { setSelectedDay(dateStr); setShowRegForm(false); }}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                              isSelected ? "bg-[#6800FF] text-white shadow-lg shadow-[#6800FF]/20" :
                              isToday ? "bg-slate-900 text-white" :
                              hasRecord ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" :
                              regReq?.status === "pending" ? "bg-amber-50 text-amber-600 hover:bg-amber-100" :
                              regReq?.status === "approved" ? "bg-emerald-50 text-emerald-600" :
                              isPast ? "bg-red-50 text-red-400 hover:bg-red-100" :
                              "text-slate-600 hover:bg-slate-50"
                            }`}
                          >{day}</button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-900" /> Today</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> Present</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Absent</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-50 border border-amber-200" /> Pending</div>
                  </div>
                </div>

                <div>
                  {!selectedDay ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                      <CalendarIcon size={40} className="mb-3 text-slate-200" />
                      <p className="text-sm font-medium">Select a day</p>
                      <p className="text-xs mt-1">Click on a date to view details</p>
                    </div>
                  ) : (() => {
                    const dayRecord = monthRecords.find((r) => r.date === selectedDay);
                    const dayReg = regRequests.find((r) => r.date === selectedDay);
                    const dateLabel = new Date(selectedDay + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                    return (
                      <div className="space-y-4">
                        <div>
                          <p className="text-lg font-bold text-slate-900">{dateLabel}</p>
                          <p className="text-xs font-mono text-slate-400">{selectedDay}</p>
                        </div>

                        {dayRecord && (
                          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${dayRecord.status === "present" ? "bg-emerald-100 text-emerald-700" : dayRecord.status === "half-day" ? "bg-amber-100 text-amber-700" : dayRecord.status === "leave" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}>{dayRecord.status}</span>
                              <span className="text-sm font-semibold text-slate-700">{Math.floor(dayRecord.totalMinutes / 60)}h {dayRecord.totalMinutes % 60}m</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white rounded-lg p-3 border border-slate-100">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase">Punch In</p>
                                <p className="text-base font-bold text-slate-800 tabular-nums">{dayRecord.punchIn ? to12h(dayRecord.punchIn) : "--"}</p>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-slate-100">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase">Punch Out</p>
                                <p className="text-base font-bold text-slate-800 tabular-nums">{dayRecord.punchOut ? to12h(dayRecord.punchOut) : "--"}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {dayReg && (
                          <div className={`rounded-xl p-4 space-y-2 ${dayReg.status === "pending" ? "bg-amber-50 border border-amber-100" : dayReg.status === "approved" ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${dayReg.status === "pending" ? "bg-amber-100 text-amber-700" : dayReg.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>Regularize: {dayReg.status}</span>
                            </div>
                            <p className="text-sm text-slate-700"><span className="font-semibold">Time:</span> {dayReg.punchIn} → {dayReg.punchOut}</p>
                            <p className="text-sm text-slate-600"><span className="font-semibold">Reason:</span> {dayReg.reason}</p>
                          </div>
                        )}

                        {!dayRecord && !dayReg && (
                          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
                            <p className="text-sm font-semibold text-red-600">No attendance record</p>
                            <p className="text-xs text-red-400 mt-0.5">You can submit a regularize request below</p>
                          </div>
                        )}

                        {!dayRecord && !dayReg && (
                          <>
                            {!showRegForm ? (
                              <button onClick={() => setShowRegForm(true)} className="w-full py-3 bg-[#6800FF] hover:bg-[#5800DD] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                                <FileText size={16} /> Regularize Attendance
                              </button>
                            ) : (
                              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                                <p className="text-sm font-semibold text-slate-700">Submit Regularize Request</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-xs font-semibold text-slate-400 uppercase mb-1 block">Punch In</label>
                                    <input type="time" value={regForm.punchIn} onChange={(e) => setRegForm({ ...regForm, punchIn: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF]" />
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-slate-400 uppercase mb-1 block">Punch Out</label>
                                    <input type="time" value={regForm.punchOut} onChange={(e) => setRegForm({ ...regForm, punchOut: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF]" />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-400 uppercase mb-1 block">Reason</label>
                                  <textarea value={regForm.reason} onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })} rows={3} placeholder="Explain why you missed punching in/out..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] resize-none" />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={submitRegularize} disabled={regLoading} className="flex-1 py-2.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-200 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                                    <Send size={14} /> {regLoading ? "Submitting..." : "Submit Request"}
                                  </button>
                                  <button onClick={() => { setShowRegForm(false); setRegForm({ punchIn: "", punchOut: "", reason: "" }); }} className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-xl transition-colors">Cancel</button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isAdmin && adminRequests.length > 0 && (
        <div className="max-w-350 mx-auto mt-6">
          <div className="bg-white rounded-4xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-[#6800FF]" />
              Pending Regularize Requests
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{adminRequests.length}</span>
            </h3>
            <div className="space-y-3">
              {adminRequests.map((r) => (
                <div key={r._id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-full bg-[#e0ccff] text-[#6800FF] flex items-center justify-center text-sm font-bold shrink-0">
                    {r.userName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-slate-900">{r.userName}</p>
                      <span className="text-xs text-slate-400">{r.date}</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-1">
                      <span className="font-medium">Time:</span> {r.punchIn} → {r.punchOut}
                    </p>
                    <p className="text-xs text-slate-500">
                      <span className="font-medium">Reason:</span> {r.reason}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleRegAction(r._id, "approve")} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors">Approve</button>
                    <button onClick={() => handleRegAction(r._id, "reject")} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showLeavePopup && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => { setShowLeavePopup(false); setLeaveStep("select"); setLeaveType(""); }} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {leaveStep === "select" ? "Apply for Leave" : "Leave Application"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {leaveStep === "select" ? "Select a reason for your leave" : `${leaveType} — Review & Submit`}
                </p>
              </div>
              <button onClick={() => { setShowLeavePopup(false); setLeaveStep("select"); setLeaveType(""); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {leaveStep === "select" && (
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Select Date</label>
                    <input
                      type="date"
                      value={leaveDate}
                      onChange={(e) => setLeaveDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#6800FF] focus:ring-1 focus:ring-[#6800FF]/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase mb-3 block">Select Reason</label>
                    <div className="grid grid-cols-2 gap-3">
                      {LEAVE_TYPES.map((lt) => (
                        <button
                          key={lt.value}
                          onClick={() => setLeaveType(lt.value)}
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                            leaveType === lt.value
                              ? "border-[#6800FF] bg-[#6800FF]/5 shadow-sm"
                              : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-2xl mt-0.5">{lt.icon}</span>
                          <div>
                            <p className={`text-sm font-semibold ${leaveType === lt.value ? "text-[#6800FF]" : "text-slate-800"}`}>{lt.value}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{lt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => { if (leaveType && leaveDate) setLeaveStep("application"); }}
                    disabled={!leaveType || !leaveDate}
                    className="w-full py-3.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowRight size={16} /> Review Application
                  </button>

                  {myLeaveRequests.length > 0 && (
                    <div className="border-t border-slate-100 pt-5">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Your Recent Leave Requests</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {myLeaveRequests.slice(0, 5).map((lr) => (
                          <div key={lr._id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${
                                lr.status === "approved" ? "bg-emerald-500" : lr.status === "denied" ? "bg-red-500" : "bg-amber-500"
                              }`} />
                              <div>
                                <p className="text-sm font-medium text-slate-800">{lr.leaveType}</p>
                                <p className="text-[11px] text-slate-400">{new Date(lr.leaveDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                              </div>
                            </div>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              lr.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                              lr.status === "denied" ? "bg-red-100 text-red-600" :
                              "bg-amber-100 text-amber-700"
                            }`}>{lr.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {leaveStep === "application" && (
                <div className="space-y-5">
                  <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-200">
                      <div className="w-10 h-10 rounded-full bg-[#e0ccff] text-[#6800FF] flex items-center justify-center text-sm font-bold">
                        {user.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{user.name}</p>
                        <p className="text-[11px] text-slate-400">{user.email}</p>
                      </div>
                    </div>

                    <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
                      {user.approverId && (
                        <div className="flex items-center justify-between bg-[#6800FF]/5 rounded-lg p-3 border border-[#6800FF]/10">
                          <span className="text-xs font-semibold text-slate-400 uppercase">Addressed to</span>
                          <span className="font-semibold text-[#6800FF]">{user.approverId.charAt(0).toUpperCase() + user.approverId.slice(1)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-slate-100">
                        <span className="text-xs font-semibold text-slate-400 uppercase">Subject</span>
                        <span className="font-medium text-slate-800">Application for {leaveType}</span>
                      </div>

                      <div className="bg-white rounded-lg p-4 border border-slate-100 space-y-3">
                        <p>Dear {user.approverId ? user.approverId.charAt(0).toUpperCase() + user.approverId.slice(1) : "Admin"},</p>
                        <p>
                          I am writing to formally request <span className="font-semibold text-[#6800FF]">{leaveType.toLowerCase()}</span> on{" "}
                          <span className="font-semibold">
                            {new Date(leaveDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                          </span>.
                        </p>

                        <div className="grid grid-cols-2 gap-3 my-3">
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase">Leave Type</p>
                            <p className="text-sm font-bold text-slate-800 mt-0.5">{leaveType}</p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase">Date</p>
                            <p className="text-sm font-bold text-slate-800 mt-0.5">
                              {new Date(leaveDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                        </div>

                        <p>I kindly request you to approve my leave application.</p>
                        <p>Thank you.</p>
                        <div className="pt-2 border-t border-slate-100">
                          <p className="font-medium">Regards,</p>
                          <p className="font-bold text-slate-900">{user.name}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setLeaveStep("select")}
                      className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={submitLeaveApplication}
                      disabled={leaveLoading}
                      className="flex-1 py-3 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-200 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Send size={15} /> {leaveLoading ? "Submitting..." : "Send Application to Admin"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {isAdmin && adminLeaveRequests.length > 0 && (
        <div className="max-w-350 mx-auto mt-6">
          <div className="bg-white rounded-4xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ClipboardList size={18} className="text-[#6800FF]" />
              Pending Leave Applications
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{adminLeaveRequests.length}</span>
            </h3>
            <div className="space-y-4">
              {adminLeaveRequests.map((lr) => (
                <div key={lr._id} className="bg-slate-50 rounded-2xl overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#e0ccff] text-[#6800FF] flex items-center justify-center text-sm font-bold shrink-0">
                        {lr.userName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-slate-900">{lr.userName}</p>
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <Clock size={10} /> Pending
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                          <span className="font-medium">{lr.leaveType}</span>
                          <span>•</span>
                          <span>{new Date(lr.leaveDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-slate-100 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                          {lr.body}
                        </div>

                        <div className="flex items-center gap-3 mt-4">
                          <button
                            onClick={() => handleLeaveAction(lr._id, "approve")}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                          <button
                            onClick={() => handleLeaveAction(lr._id, "deny")}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <XCircle size={13} /> Deny
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showMeetingsPopup && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowMeetingsPopup(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Today&apos;s Meetings</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {calendarConnected ? `${calendarEvents.length} meeting${calendarEvents.length !== 1 ? "s" : ""} today` : "Google Calendar"}
                </p>
              </div>
              <button onClick={() => setShowMeetingsPopup(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {calendarConnected === false && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#6800FF]/10 flex items-center justify-center">
                    <CalendarIcon size={28} className="text-[#6800FF]" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mb-1">Connect Your Calendar</h4>
                  <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">Link your Google Calendar to see meetings and join calls from here</p>
                  <button onClick={connectCalendar} disabled={calendarConnecting} className="inline-flex items-center gap-2 px-6 py-3 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white font-semibold rounded-xl transition-colors">
                    {calendarConnecting ? <><Loader2 size={16} className="animate-spin" /> Connecting...</> : <><Video size={16} /> Connect Google Calendar</>}
                  </button>
                </div>
              )}

              {calendarConnected && calendarEvents.length === 0 && (
                <div className="text-center py-8">
                  <CalendarIcon size={40} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-base font-semibold text-slate-400">No meetings today</p>
                  <p className="text-sm text-slate-300 mt-1">Your schedule is clear</p>
                </div>
              )}

              {calendarConnected && calendarEvents.length > 0 && (
                <div className="space-y-3">
                  {calendarEvents.map((event) => {
                    const live = isMeetingNow(event.start, event.end);
                    const isPast = new Date(event.end).getTime() < now;
                    return (
                      <div key={event.id} className={`rounded-xl border p-4 transition-all ${
                        live ? "border-emerald-200 bg-emerald-50/50" :
                        isPast ? "border-slate-100 bg-slate-50/50 opacity-60" :
                        "border-slate-200 bg-white hover:shadow-sm"
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              {live && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>}
                              <h4 className="text-sm font-semibold text-slate-900 truncate">{event.summary}</h4>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Clock size={11} /> {fmtMeetTime(event.start)} — {fmtMeetTime(event.end)}</span>
                              <span className="text-slate-300">{getMeetDuration(event.start, event.end)}</span>
                            </div>
                            {event.location && <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1"><MapPin size={10} /> {event.location}</p>}
                            {event.attendees.length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                <Users size={11} className="text-slate-400" />
                                <div className="flex -space-x-1.5">
                                  {event.attendees.slice(0, 5).map((a) => (
                                    <div key={a.email} className="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px] font-bold text-slate-600" title={a.name || a.email}>
                                      {(a.name || a.email)[0].toUpperCase()}
                                    </div>
                                  ))}
                                  {event.attendees.length > 5 && <span className="text-[10px] text-slate-400 ml-1.5">+{event.attendees.length - 5}</span>}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            {event.meetLink && !isPast && (
                              <a href={event.meetLink} target="_blank" rel="noopener noreferrer" className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                                live ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-[#6800FF] hover:bg-[#5800DD] text-white"
                              }`}>
                                <Video size={13} /> {live ? "Join Now" : "Join"}
                              </a>
                            )}
                            <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:text-[#6800FF] hover:border-[#6800FF]/30 transition-colors flex items-center gap-1.5">
                              <ExternalLink size={11} /> Open
                            </a>
                          </div>
                        </div>
                        {event.meetLink && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <a href={event.meetLink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#6800FF] hover:text-[#5800DD] flex items-center gap-1 truncate">
                              <LinkIcon size={10} /> {event.meetLink}
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {showHolidays && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setShowHolidays(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Holiday List 2026</h3>
                <p className="text-xs text-slate-400 mt-0.5">Thyleads — Official Holidays</p>
              </div>
              <button onClick={() => setShowHolidays(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="text-left py-2 font-semibold">#</th>
                    <th className="text-left py-2 font-semibold">Date</th>
                    <th className="text-left py-2 font-semibold">Day</th>
                    <th className="text-left py-2 font-semibold">Holiday</th>
                  </tr>
                </thead>
                <tbody>
                  {HOLIDAYS.map((h, i) => {
                    const isPast = h.date < new Date().toISOString().split("T")[0];
                    const isNext = h.date === nextHoliday.date;
                    return (
                      <tr key={h.date} className={`border-b border-slate-50 ${isNext ? "bg-orange-50" : isPast ? "opacity-50" : ""}`}>
                        <td className="py-3 text-slate-500">{i + 1}</td>
                        <td className="py-3 text-slate-700 font-medium">{new Date(h.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td className="py-3 text-slate-600">{h.day}</td>
                        <td className="py-3 font-medium text-slate-900">
                          {h.name}
                          {isNext && <span className="ml-2 text-[10px] bg-[#6800FF] text-white px-2 py-0.5 rounded-full font-bold">Next</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
