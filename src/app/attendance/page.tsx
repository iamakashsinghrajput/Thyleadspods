"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Maximize2,
  ClipboardList,
  ArrowUpRight,
  ArrowRight,
  Calendar as CalendarIcon,
  ChevronRight,
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
import { usePods } from "@/lib/pod-context";
import { SEED_USERS } from "@/lib/seed-users";

function getUserId(name: string): string {
  return name.toLowerCase().replace(/\s/g, "").split(/\s/)[0];
}

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

const IST_TZ = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

function istParts(d: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  return {
    date: `${m.year}-${m.month}-${m.day}`,
    hour: Number(m.hour),
    minute: Number(m.minute),
  };
}

function getNextHoliday() {
  const today = istParts().date;
  return HOLIDAYS.find((h) => h.date >= today) || HOLIDAYS[0];
}

function getGreeting() {
  const h = istParts().hour;
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

interface PodAttendanceRow {
  userId: string;
  userName: string;
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  totalMinutes: number;
  status: string;
  isWfh?: boolean;
  rePunchCount?: number;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const { pods } = usePods();
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
  const [customReason, setCustomReason] = useState("");
  const [leaveBody, setLeaveBody] = useState("");
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
  const [adminLeaveRequests, setAdminLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveAdminNote, setLeaveAdminNote] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [showMeetingsPopup, setShowMeetingsPopup] = useState(false);
  const [calendarConnecting, setCalendarConnecting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [sessionStartAt, setSessionStartAt] = useState<{ date: string; punchIn: string; at: number } | null>(null);
  const [podViewMode, setPodViewMode] = useState(false);
  const [podAttendanceRecords, setPodAttendanceRecords] = useState<PodAttendanceRow[]>([]);
  const [podAttendanceDate, setPodAttendanceDate] = useState<string>("");
  const [podAttendanceLoading, setPodAttendanceLoading] = useState(false);
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  const [regularizeHistory, setRegularizeHistory] = useState<RegRequest[]>([]);
  const [selectedMember, setSelectedMember] = useState<{ userName: string; userId: string; podId: string; podName: string; podColor: string } | null>(null);
  const [memberMonth, setMemberMonth] = useState<string>("");
  const [memberMonthRecords, setMemberMonthRecords] = useState<AttendanceRecord[]>([]);
  const [memberLeaveHistory, setMemberLeaveHistory] = useState<LeaveRequest[]>([]);
  const [memberRegularizeHistory, setMemberRegularizeHistory] = useState<RegRequest[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);

  const nextHoliday = getNextHoliday();
  const userId = user ? getUserId(user.name) : "";
  const todayDate = istParts(new Date(now)).date;

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
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

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
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName: user.name, action }),
      });
      const data = await res.json();
      if (action === "punchIn" && data?.record?.punchIn) {
        setSessionStartAt({ date: data.record.date, punchIn: data.record.punchIn, at: Date.now() });
      }
      if (action === "punchOut") setSessionStartAt(null);
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
  const isSuperadmin = user?.role === "superadmin";

  const fetchAdminRequests = useCallback(async () => {
    if (!isAdmin || !userId) return;
    try {
      const qs = isSuperadmin
        ? `all=true&status=pending`
        : `all=true&status=pending&approverId=${userId}`;
      const res = await fetch(`/api/regularize?${qs}`);
      const data = await res.json();
      setAdminRequests(data.records || []);
    } catch {}
  }, [isAdmin, isSuperadmin, userId]);

  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchAdminRequests(); })();
    return () => { ignore = true; };
  }, [fetchAdminRequests]);

  const fetchPodAttendance = useCallback(async (dateStr: string) => {
    if (!isAdmin || !dateStr) return;
    try {
      const res = await fetch(`/api/attendance?all=true&dateFilter=${dateStr}`);
      const data = await res.json();
      setPodAttendanceRecords(data.records || []);
    } catch {}
  }, [isAdmin]);

  useEffect(() => {
    if (!podViewMode || !isAdmin) return;
    let ignore = false;
    const target = podAttendanceDate || todayDate;
    (async () => {
      if (ignore) return;
      setPodAttendanceLoading(true);
      await fetchPodAttendance(target);
      if (!ignore) setPodAttendanceLoading(false);
    })();
    return () => { ignore = true; };
  }, [podViewMode, isAdmin, podAttendanceDate, todayDate, fetchPodAttendance]);

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
      const qs = isSuperadmin
        ? `all=true&status=pending`
        : `all=true&status=pending&approverId=${userId}`;
      const res = await fetch(`/api/leave?${qs}`);
      const data = await res.json();
      setAdminLeaveRequests(data.records || []);
    } catch {}
  }, [isAdmin, isSuperadmin, userId]);

  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchAdminLeaveRequests(); })();
    return () => { ignore = true; };
  }, [fetchAdminLeaveRequests]);

  const fetchLeaveHistory = useCallback(async () => {
    if (!isSuperadmin) return;
    try {
      const res = await fetch(`/api/leave?all=true`);
      const data = await res.json();
      setLeaveHistory(data.records || []);
    } catch {}
  }, [isSuperadmin]);

  const fetchRegularizeHistory = useCallback(async () => {
    if (!isSuperadmin) return;
    try {
      const res = await fetch(`/api/regularize?all=true`);
      const data = await res.json();
      setRegularizeHistory(data.records || []);
    } catch {}
  }, [isSuperadmin]);

  useEffect(() => {
    if (!selectedMember) return;
    const month = memberMonth || `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
    let ignore = false;
    (async () => {
      if (ignore) return;
      setMemberLoading(true);
      try {
        const [attRes, leaveRes, regRes] = await Promise.all([
          fetch(`/api/attendance?userId=${encodeURIComponent(selectedMember.userId)}&month=${month}`, { cache: "no-store" }),
          fetch(`/api/leave?userId=${encodeURIComponent(selectedMember.userId)}`, { cache: "no-store" }),
          fetch(`/api/regularize?userId=${encodeURIComponent(selectedMember.userId)}`, { cache: "no-store" }),
        ]);
        const [attData, leaveData, regData] = await Promise.all([attRes.json(), leaveRes.json(), regRes.json()]);
        if (!ignore) {
          setMemberMonthRecords(attData.records || []);
          setMemberLeaveHistory(leaveData.records || []);
          setMemberRegularizeHistory(regData.records || []);
        }
      } catch {}
      if (!ignore) setMemberLoading(false);
    })();
    return () => { ignore = true; };
  }, [selectedMember, memberMonth, calYear, calMonth]);

  useEffect(() => {
    if (!podViewMode || !isSuperadmin) return;
    let ignore = false;
    (async () => {
      if (ignore) return;
      await Promise.all([fetchLeaveHistory(), fetchRegularizeHistory()]);
    })();
    return () => { ignore = true; };
  }, [podViewMode, isSuperadmin, fetchLeaveHistory, fetchRegularizeHistory]);

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
    if (isSuperadmin) await fetchLeaveHistory();
    if (selectedMember) {
      try {
        const res = await fetch(`/api/leave?userId=${encodeURIComponent(selectedMember.userId)}`, { cache: "no-store" });
        const data = await res.json();
        setMemberLeaveHistory(data.records || []);
      } catch {}
    }
  }

  async function submitLeaveApplication() {
    if (!user || !leaveType || !leaveDate || !leaveBody.trim()) return;
    setLeaveLoading(true);
    const reason = leaveType === "Other" ? customReason.trim() : leaveType;
    const subject = `Application for ${reason} on ${new Date(leaveDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`;
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          userId,
          userName: user.name,
          leaveDate,
          leaveType: reason,
          subject,
          body: leaveBody,
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
        setCustomReason("");
        setLeaveBody("");
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
    if (isSuperadmin) await fetchRegularizeHistory();
    if (selectedMember) {
      try {
        const res = await fetch(`/api/regularize?userId=${encodeURIComponent(selectedMember.userId)}`, { cache: "no-store" });
        const data = await res.json();
        setMemberRegularizeHistory(data.records || []);
      } catch {}
    }
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

  if (!user) return null;

  const isPunchedIn = !!(today?.punchIn && !today?.punchOut);
  const isPunchedOut = !!(today?.punchIn && today?.punchOut);

  const { hour: currentHour, minute: currentMin } = istParts(new Date(now));
  const currentTimeMin = currentHour * 60 + currentMin;
  const punchAllowedFrom = 9 * 60 + 30;
  const punchAllowedUntil = 23 * 60 + 59;
  const isPunchTimeAllowed = currentTimeMin >= punchAllowedFrom && currentTimeMin <= punchAllowedUntil;

  const isMissedPunchOut = (r: AttendanceRecord) =>
    !!(r.punchIn && !r.punchOut && r.date !== todayDate && r.date < todayDate);
  const missedDateSet = new Set(monthRecords.filter(isMissedPunchOut).map((r) => r.date));

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
    const localAnchor =
      sessionStartAt &&
      sessionStartAt.date === today.date &&
      sessionStartAt.punchIn === today.punchIn
        ? sessionStartAt.at
        : null;
    const inTime = localAnchor ?? new Date(`${todayDate}T${today.punchIn}:00${IST_OFFSET}`).getTime();
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
      {isAdmin && (
        <div className="max-w-350 mx-auto mb-4 flex items-center justify-end gap-2">
          {podViewMode && (
            <input
              type="date"
              value={podAttendanceDate || todayDate}
              onChange={(e) => setPodAttendanceDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF] shadow-sm"
            />
          )}
          <button
            onClick={() => {
              setPodViewMode((v) => {
                if (v) setSelectedMember(null);
                return !v;
              });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#6800FF] hover:bg-[#5800DD] text-white transition-colors shadow-sm"
          >
            <Users size={14} />
            {podViewMode ? "Back to My Attendance" : "View Member Attendance"}
          </button>
        </div>
      )}

      {isAdmin && podViewMode && selectedMember ? (
        <div className="max-w-350 mx-auto">
          {(() => {
            const monthStr = memberMonth || `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
            const [yyyy, mm] = monthStr.split("-").map(Number);
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            const isCurrentMonth = today.getFullYear() === yyyy && today.getMonth() + 1 === mm;
            const daysInMonth = new Date(yyyy, mm, 0).getDate();
            const endDay = isCurrentMonth ? today.getDate() : daysInMonth;

            let workingDays = 0;
            for (let d = 1; d <= endDay; d++) {
              const wd = new Date(yyyy, mm - 1, d).getDay();
              if (wd !== 0 && wd !== 6) workingDays++;
            }

            const present = memberMonthRecords.filter((r) => r.status === "present").length;
            const halfDay = memberMonthRecords.filter((r) => r.status === "half-day").length;
            const leave = memberMonthRecords.filter((r) => r.status === "leave").length;
            const wfh = memberMonthRecords.filter((r) => (r as AttendanceRecord & { isWfh?: boolean }).isWfh).length;
            const attended = present + halfDay;
            const absent = Math.max(0, workingDays - attended - leave);
            const rate = workingDays > 0 ? Math.round((attended / workingDays) * 100) : 0;
            const totalMinutes = memberMonthRecords.reduce((s, r) => s + (r.totalMinutes || 0), 0);
            const hrs = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            const avgHrs = attended > 0 ? (totalMinutes / attended / 60).toFixed(1) : "0.0";

            const firstWeekday = new Date(yyyy, mm - 1, 1).getDay();
            const recMap = new Map<string, AttendanceRecord>();
            memberMonthRecords.forEach((r) => recMap.set(r.date, r));

            const todayRec = memberMonthRecords.find((r) => r.date === todayStr);
            const todayIsWfh = !!(todayRec && (todayRec as AttendanceRecord & { isWfh?: boolean }).isWfh);
            const todayPendingLeave = memberLeaveHistory.find((lr) => lr.leaveDate === todayStr && lr.status === "approved");
            const todayStatus: { label: string; cls: string; dot: string } =
              todayRec?.status === "present" && !todayIsWfh ? { label: "Present today", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" }
              : todayIsWfh ? { label: "WFH today", cls: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-600" }
              : todayRec?.status === "half-day" ? { label: "Half-day today", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" }
              : todayRec?.status === "leave" || todayPendingLeave ? { label: "On leave today", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" }
              : { label: "Not punched in", cls: "bg-slate-50 text-slate-500 border-slate-200", dot: "bg-slate-400" };

            let currentStreak = 0;
            const sortedDesc = [...memberMonthRecords].sort((a, b) => b.date.localeCompare(a.date));
            for (const r of sortedDesc) {
              if (r.date > todayStr) continue;
              if (r.status === "present" || r.status === "half-day") currentStreak++;
              else break;
            }

            const calendarCells: Array<{ day: number; dateStr: string; rec?: AttendanceRecord; isWeekend: boolean; isFuture: boolean; isToday: boolean; isWfh: boolean } | null> = [];
            for (let i = 0; i < firstWeekday; i++) calendarCells.push(null);
            for (let d = 1; d <= daysInMonth; d++) {
              const ds = `${yyyy}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const rec = recMap.get(ds);
              const wd = new Date(yyyy, mm - 1, d).getDay();
              calendarCells.push({
                day: d,
                dateStr: ds,
                rec,
                isWeekend: wd === 0 || wd === 6,
                isFuture: ds > todayStr,
                isToday: ds === todayStr,
                isWfh: !!(rec && (rec as AttendanceRecord & { isWfh?: boolean }).isWfh),
              });
            }

            const pendingLeaves = memberLeaveHistory.filter((l) => l.status === "pending").length;
            const pendingRegs = memberRegularizeHistory.filter((r) => r.status === "pending").length;
            const onTimeDays = memberMonthRecords.filter((r) => r.punchIn && r.punchIn <= "09:30").length;
            const lateDays = memberMonthRecords.filter((r) => r.punchIn && r.punchIn > "09:30").length;

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <ArrowRight size={14} className="rotate-180" />
                    <span>Member Attendance</span>
                    <ChevronRight size={14} className="text-slate-300" />
                    <span className="text-slate-900 font-semibold">{selectedMember.userName}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {memberLoading && <Loader2 className="text-slate-400 animate-spin" size={14} />}
                    <label className="text-xs font-semibold text-slate-500">Period</label>
                    <input
                      type="month"
                      value={monthStr}
                      onChange={(e) => setMemberMonth(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 shadow-sm"
                    />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xl font-bold shrink-0">
                        {selectedMember.userName[0]}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-slate-900 leading-tight truncate">{selectedMember.userName}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            <span className={`w-1.5 h-1.5 rounded-full ${selectedMember.podColor}`} />
                            {selectedMember.podName}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md border ${todayStatus.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${todayStatus.dot}`} />
                            {todayStatus.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6 lg:gap-8 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-8">
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Punch in</p>
                        <p className="text-base font-bold text-slate-900 tabular-nums mt-0.5">{todayRec?.punchIn ? to12h(todayRec.punchIn) : <span className="text-slate-300 font-medium">—</span>}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Punch out</p>
                        <p className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                          {todayRec?.punchOut ? to12h(todayRec.punchOut) : todayRec?.punchIn ? <span className="text-emerald-600">active</span> : <span className="text-slate-300 font-medium">—</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Hours today</p>
                        <p className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                          {todayRec && todayRec.totalMinutes > 0 ? `${Math.floor(todayRec.totalMinutes / 60)}h ${todayRec.totalMinutes % 60}m` : <span className="text-slate-300 font-medium">—</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Attendance</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{rate}<span className="text-base text-slate-400">%</span></p>
                    <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-900 rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">{attended} / {workingDays} workdays</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Present</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{present}</p>
                    <p className="text-[10px] text-slate-500 mt-2.5">Full days attended</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Half-day</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{halfDay}</p>
                    <p className="text-[10px] text-slate-500 mt-2.5">Partial days</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />WFH</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{wfh}</p>
                    <p className="text-[10px] text-slate-500 mt-2.5">Remote days</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Leave</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{leave}</p>
                    <p className="text-[10px] text-slate-500 mt-2.5">Approved leaves</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />Absent</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{absent}</p>
                    <p className="text-[10px] text-slate-500 mt-2.5">Unaccounted</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total hours</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{hrs}<span className="text-base text-slate-400">h</span> {mins}<span className="text-base text-slate-400">m</span></p>
                    <p className="text-[10px] text-slate-500 mt-2.5">Avg {avgHrs}h / day</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <CalendarIcon size={14} className="text-slate-600" />
                          {new Date(yyyy, mm - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">Daily attendance calendar</p>
                      </div>
                      <div className="flex flex-wrap gap-2.5 text-[10px] font-medium text-slate-600">
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400" />Present</span>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400" />Half</span>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-400" />WFH</span>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400" />Leave</span>
                        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-300" />Absent</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-1.5">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                        <div key={i} className="text-[10px] font-semibold text-slate-500 text-center py-1.5">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarCells.map((c, i) => {
                        if (!c) return <div key={`e-${i}`} className="aspect-square" />;
                        const { day, dateStr, rec, isWeekend, isFuture, isToday, isWfh } = c;
                        let cls = "bg-white text-slate-300 border-slate-100";
                        let dotColor = "";
                        if (isFuture) {
                          cls = "bg-white text-slate-300 border-slate-100";
                        } else if (isWfh) {
                          cls = "bg-indigo-50 text-indigo-900 border-indigo-200";
                          dotColor = "bg-indigo-500";
                        } else if (rec?.status === "present") {
                          cls = "bg-emerald-50 text-emerald-900 border-emerald-200";
                          dotColor = "bg-emerald-500";
                        } else if (rec?.status === "half-day") {
                          cls = "bg-amber-50 text-amber-900 border-amber-200";
                          dotColor = "bg-amber-500";
                        } else if (rec?.status === "leave") {
                          cls = "bg-red-50 text-red-900 border-red-200";
                          dotColor = "bg-red-500";
                        } else if (isWeekend) {
                          cls = "bg-slate-50 text-slate-400 border-slate-100";
                        } else {
                          cls = "bg-rose-50/50 text-rose-600 border-rose-100";
                          dotColor = "bg-rose-400";
                        }
                        const tooltipParts = [new Date(yyyy, mm - 1, day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })];
                        if (rec) {
                          tooltipParts.push(`${rec.status}${isWfh ? " · WFH" : ""}`);
                          if (rec.punchIn) tooltipParts.push(`${to12h(rec.punchIn)} → ${rec.punchOut ? to12h(rec.punchOut) : "active"}`);
                        } else if (!isFuture && !isWeekend) {
                          tooltipParts.push("Absent");
                        } else if (isWeekend) {
                          tooltipParts.push("Weekend");
                        }
                        return (
                          <div
                            key={dateStr}
                            title={tooltipParts.join(" · ")}
                            className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-semibold border relative transition-all hover:ring-1 hover:ring-slate-300 ${cls} ${isToday ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}
                          >
                            <span>{day}</span>
                            {dotColor && <span className={`w-1 h-1 rounded-full ${dotColor} mt-0.5`} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900">Month breakdown</h3>
                        <span className="text-[10px] font-semibold text-slate-500">of {workingDays} workdays</span>
                      </div>
                      <div className="space-y-3">
                        {[
                          { label: "Present", value: present, color: "bg-emerald-500" },
                          { label: "Half-day", value: halfDay, color: "bg-amber-500" },
                          { label: "WFH", value: wfh, color: "bg-indigo-500" },
                          { label: "Leave", value: leave, color: "bg-red-500" },
                          { label: "Absent", value: absent, color: "bg-rose-400" },
                        ].map((row) => {
                          const pct = workingDays > 0 ? (row.value / workingDays) * 100 : 0;
                          return (
                            <div key={row.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-sm ${row.color}`} />{row.label}</span>
                                <span className="text-xs font-bold text-slate-900 tabular-nums">{row.value} <span className="text-slate-400 font-medium">({Math.round(pct)}%)</span></span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${row.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                      <h3 className="text-sm font-bold text-slate-900 mb-4">Punctuality & streaks</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">On time</p>
                          <p className="text-xl font-bold text-emerald-600 tabular-nums mt-0.5">{onTimeDays}</p>
                          <p className="text-[10px] text-slate-500">before 9:30 AM</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Late</p>
                          <p className="text-xl font-bold text-amber-600 tabular-nums mt-0.5">{lateDays}</p>
                          <p className="text-[10px] text-slate-500">after 9:30 AM</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Current streak</p>
                          <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">{currentStreak}<span className="text-sm text-slate-400 font-medium"> {currentStreak === 1 ? "day" : "days"}</span></p>
                          <p className="text-[10px] text-slate-500">consecutive</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Pending</p>
                          <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">{pendingLeaves + pendingRegs}</p>
                          <p className="text-[10px] text-slate-500">approval requests</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Attendance log</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Daily punch in/out records for {new Date(yyyy, mm - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md tabular-nums">{memberMonthRecords.length} records</span>
                  </div>
                  {memberMonthRecords.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-slate-400">No attendance records for this month.</div>
                  ) : (
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                            <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Day</th>
                            <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Punch in</th>
                            <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Punch out</th>
                            <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Hours</th>
                            <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Type</th>
                            <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[...memberMonthRecords].sort((a, b) => b.date.localeCompare(a.date)).map((r) => {
                            const d = new Date(r.date);
                            const mh = Math.floor((r.totalMinutes || 0) / 60);
                            const mrem = (r.totalMinutes || 0) % 60;
                            const isWfh = (r as AttendanceRecord & { isWfh?: boolean }).isWfh;
                            const late = r.punchIn && r.punchIn > "09:30";
                            return (
                              <tr key={r.date} className="hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-3 font-semibold text-slate-900 tabular-nums">{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                                <td className="px-5 py-3 text-slate-600">{d.toLocaleDateString("en-US", { weekday: "short" })}</td>
                                <td className="px-5 py-3 text-slate-700 tabular-nums font-medium">
                                  {r.punchIn ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      {to12h(r.punchIn)}
                                      {late && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">LATE</span>}
                                    </span>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-5 py-3 text-slate-700 tabular-nums font-medium">
                                  {r.punchOut ? to12h(r.punchOut) : r.punchIn ? <span className="text-emerald-600 font-semibold">active</span> : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-5 py-3 text-slate-700 tabular-nums">{r.totalMinutes ? `${mh}h ${mrem}m` : <span className="text-slate-300">—</span>}</td>
                                <td className="px-5 py-3">
                                  {isWfh ? <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">WFH</span> : <span className="text-[10px] font-semibold text-slate-500">Office</span>}
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md capitalize ${
                                    r.status === "present" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                    r.status === "half-day" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                                    r.status === "leave" ? "bg-red-50 text-red-700 border border-red-100" : "bg-slate-100 text-slate-600 border border-slate-200"
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      r.status === "present" ? "bg-emerald-500" :
                                      r.status === "half-day" ? "bg-amber-500" :
                                      r.status === "leave" ? "bg-red-500" : "bg-slate-400"
                                    }`} />
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <ClipboardList size={14} className="text-slate-600" />
                          Leave requests
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">{pendingLeaves > 0 ? `${pendingLeaves} awaiting your approval` : "All requests reviewed"}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md tabular-nums">{memberLeaveHistory.length}</span>
                    </div>
                    {memberLeaveHistory.length === 0 ? (
                      <div className="px-5 py-10 text-center text-sm text-slate-400">No leave requests submitted.</div>
                    ) : (
                      <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                        {memberLeaveHistory.map((lr) => (
                          <li key={lr._id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-slate-900">{lr.leaveType}</p>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold capitalize px-1.5 py-0.5 rounded ${
                                  lr.status === "approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                  lr.status === "denied" ? "bg-red-50 text-red-700 border border-red-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                                }`}>
                                  <span className={`w-1 h-1 rounded-full ${
                                    lr.status === "approved" ? "bg-emerald-500" :
                                    lr.status === "denied" ? "bg-red-500" : "bg-amber-500"
                                  }`} />
                                  {lr.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                {new Date(lr.leaveDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                              </p>
                              {lr.subject && <p className="text-[12px] text-slate-600 mt-1 line-clamp-2">{lr.subject}</p>}
                            </div>
                            {lr.status === "pending" && (
                              <div className="flex gap-1.5 shrink-0">
                                <button onClick={() => handleLeaveAction(lr._id, "approve")} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                                  <CheckCircle2 size={12} /> Approve
                                </button>
                                <button onClick={() => handleLeaveAction(lr._id, "deny")} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors">
                                  <XCircle size={12} /> Deny
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <FileText size={14} className="text-slate-600" />
                          Regularize requests
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">{pendingRegs > 0 ? `${pendingRegs} awaiting your approval` : "All requests reviewed"}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md tabular-nums">{memberRegularizeHistory.length}</span>
                    </div>
                    {memberRegularizeHistory.length === 0 ? (
                      <div className="px-5 py-10 text-center text-sm text-slate-400">No regularize requests submitted.</div>
                    ) : (
                      <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                        {memberRegularizeHistory.map((rq) => (
                          <li key={rq._id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-slate-900 tabular-nums">{rq.punchIn} → {rq.punchOut}</p>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold capitalize px-1.5 py-0.5 rounded ${
                                  rq.status === "approved" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                  rq.status === "rejected" ? "bg-red-50 text-red-700 border border-red-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                                }`}>
                                  <span className={`w-1 h-1 rounded-full ${
                                    rq.status === "approved" ? "bg-emerald-500" :
                                    rq.status === "rejected" ? "bg-red-500" : "bg-amber-500"
                                  }`} />
                                  {rq.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                {new Date(rq.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                              </p>
                              {rq.reason && <p className="text-[12px] text-slate-600 mt-1 line-clamp-2">{rq.reason}</p>}
                            </div>
                            {rq.status === "pending" && (
                              <div className="flex gap-1.5 shrink-0">
                                <button onClick={() => handleRegAction(rq._id, "approve")} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                                  <CheckCircle2 size={12} /> Approve
                                </button>
                                <button onClick={() => handleRegAction(rq._id, "reject")} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors">
                                  <XCircle size={12} /> Reject
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : isAdmin && podViewMode ? (
        <div className="max-w-350 mx-auto">
          <div className="bg-white rounded-4xl p-6 lg:p-8 shadow-sm">
            {(() => {
              const firstToken = (s: string) => (s || "").trim().toLowerCase().split(/\s+/)[0] || "";
              type Row = {
                key: string;
                userName: string;
                userId: string;
                podId: string;
                podName: string;
                podColor: string;
                roleLabel: string;
                rec?: PodAttendanceRow;
                status: "present" | "half-day" | "leave" | "wfh" | "absent";
              };
              const rows: Row[] = [];
              const seenNames = new Set<string>();

              // 1. Pod members — DEDUPED by user (same person in 2 pods = 1 row).
              const memberToPods = new Map<string, { name: string; pods: { id: string; name: string; color: string }[] }>();
              for (const pod of pods) {
                for (const member of pod.members) {
                  const key = firstToken(member);
                  if (!key) continue;
                  const existing = memberToPods.get(key);
                  if (existing) {
                    if (!existing.pods.some((p) => p.id === pod.id)) {
                      existing.pods.push({ id: pod.id, name: pod.name, color: pod.color });
                    }
                  } else {
                    memberToPods.set(key, { name: member, pods: [{ id: pod.id, name: pod.name, color: pod.color }] });
                  }
                }
              }
              for (const [key, info] of memberToPods.entries()) {
                const rec = podAttendanceRecords.find((r) => firstToken(r.userName) === key);
                const isWfh = !!(rec && rec.isWfh);
                const status: Row["status"] = isWfh
                  ? "wfh"
                  : rec?.status === "present" ? "present"
                  : rec?.status === "half-day" ? "half-day"
                  : rec?.status === "leave" ? "leave"
                  : "absent";
                const podsLabel = info.pods.map((p) => p.name).join(" · ");
                rows.push({
                  key: `user:${key}`,
                  userName: rec?.userName || info.name,
                  userId: rec?.userId || getUserId(info.name),
                  podId: info.pods[0].id,
                  podName: podsLabel,
                  podColor: info.pods[0].color,
                  roleLabel: podsLabel,
                  rec,
                  status,
                });
                seenNames.add(key);
              }

              // 2. Admins + superadmin from the seed roster (so they show as cards too).
              for (const u of SEED_USERS) {
                if (u.role !== "admin" && u.role !== "superadmin") continue;
                if (seenNames.has(firstToken(u.name))) continue;
                const rec = podAttendanceRecords.find((r) => firstToken(r.userName) === firstToken(u.name));
                const isWfh = !!(rec && rec.isWfh);
                const status: Row["status"] = isWfh
                  ? "wfh"
                  : rec?.status === "present" ? "present"
                  : rec?.status === "half-day" ? "half-day"
                  : rec?.status === "leave" ? "leave"
                  : "absent";
                const label = u.role === "superadmin" ? "Super admin" : "Admin";
                rows.push({
                  key: `${u.role}:${u.name}`,
                  userName: rec?.userName || u.name,
                  userId: rec?.userId || getUserId(u.name),
                  podId: "",
                  podName: label,
                  podColor: u.role === "superadmin" ? "bg-[#6800FF]" : "bg-indigo-500",
                  roleLabel: label,
                  rec,
                  status,
                });
                seenNames.add(firstToken(u.name));
              }

              // 3. Any attendance records for people we still haven't listed.
              for (const rec of podAttendanceRecords) {
                if (seenNames.has(firstToken(rec.userName))) continue;
                const isWfh = !!rec.isWfh;
                rows.push({
                  key: `unassigned:${rec.userId}`,
                  userName: rec.userName,
                  userId: rec.userId,
                  podId: "",
                  podName: "Unassigned",
                  podColor: "bg-slate-400",
                  roleLabel: "Unassigned",
                  rec,
                  status: isWfh ? "wfh" : rec.status === "present" ? "present" : rec.status === "half-day" ? "half-day" : rec.status === "leave" ? "leave" : "absent",
                });
                seenNames.add(firstToken(rec.userName));
              }

              const counts = {
                present: rows.filter((r) => r.status === "present").length,
                half: rows.filter((r) => r.status === "half-day").length,
                leave: rows.filter((r) => r.status === "leave").length,
                wfh: rows.filter((r) => r.status === "wfh").length,
                absent: rows.filter((r) => r.status === "absent").length,
              };

              const pendingTotal = adminRequests.length + adminLeaveRequests.length;
              const pretty = new Date((podAttendanceDate || todayDate) + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

              return (
                <>
                  <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Member Attendance</h2>
                      <p className="text-xs text-slate-500 mt-0.5">{pretty} · {rows.length} member{rows.length === 1 ? "" : "s"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {podAttendanceLoading && <Loader2 className="text-[#6800FF] animate-spin" size={16} />}
                      <input
                        type="date"
                        value={podAttendanceDate || todayDate}
                        onChange={(e) => setPodAttendanceDate(e.target.value)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF] shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{counts.present} Present</span>
                    {counts.half > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-100"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{counts.half} Half-day</span>}
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-700 px-3 py-1.5 rounded-full border border-red-100"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{counts.leave} Leave</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#f0e6ff] text-[#6800FF] px-3 py-1.5 rounded-full border border-[#e0ccff]"><span className="w-1.5 h-1.5 rounded-full bg-[#6800FF]" />{counts.wfh} WFH</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-50 text-rose-600 px-3 py-1.5 rounded-full border border-rose-100"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{counts.absent} Absent</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {rows.map((row) => {
                      const { userName, userId, podId, podName, podColor, rec, status, key } = row;
                      const hrs = rec ? Math.floor(rec.totalMinutes / 60) : 0;
                      const mins = rec ? rec.totalMinutes % 60 : 0;
                      const statusStyles: Record<Row["status"], { pill: string; ring: string; dot: string; label: string }> = {
                        "present": { pill: "bg-emerald-50 text-emerald-700 border-emerald-100", ring: "ring-emerald-100", dot: "bg-emerald-500", label: "Present" },
                        "half-day": { pill: "bg-amber-50 text-amber-700 border-amber-100", ring: "ring-amber-100", dot: "bg-amber-500", label: "Half-day" },
                        "leave": { pill: "bg-red-50 text-red-700 border-red-100", ring: "ring-red-100", dot: "bg-red-500", label: "On leave" },
                        "wfh": { pill: "bg-[#f0e6ff] text-[#6800FF] border-[#e0ccff]", ring: "ring-[#e0ccff]", dot: "bg-[#6800FF]", label: "WFH" },
                        "absent": { pill: "bg-rose-50 text-rose-600 border-rose-100", ring: "ring-rose-100", dot: "bg-rose-400", label: "Absent" },
                      };
                      const s = statusStyles[status];
                      const summaryLine = status === "leave"
                        ? "On leave today"
                        : status === "absent"
                        ? (rec ? "No punch recorded" : "Not punched in")
                        : rec && rec.totalMinutes > 0
                        ? `${hrs}h ${mins}m worked`
                        : rec?.punchIn
                        ? "Shift in progress"
                        : "No activity yet";

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedMember({ userName, userId, podId, podName, podColor })}
                          className={`group text-left relative rounded-2xl border border-slate-200 bg-white p-5 hover:border-[#6800FF]/40 hover:shadow-md transition-all ring-1 ring-transparent hover:${s.ring}`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f0e6ff] to-[#e0ccff] text-[#6800FF] flex items-center justify-center text-lg font-bold shrink-0">
                                {userName[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="text-base font-bold text-slate-900 truncate">{userName}</p>
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 mt-0.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${podColor}`} />
                                  {podName}
                                </span>
                              </div>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${s.pill}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                              {s.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Punch in</p>
                              <p className="text-sm font-bold text-slate-900 tabular-nums">
                                {rec?.punchIn ? to12h(rec.punchIn) : "—"}
                              </p>
                            </div>
                            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Punch out</p>
                              <p className="text-sm font-bold text-slate-900 tabular-nums">
                                {rec?.punchOut ? to12h(rec.punchOut) : rec?.punchIn ? <span className="text-emerald-600">active</span> : "—"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                            <p className="text-xs text-slate-500 font-medium">{summaryLine}</p>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6800FF] opacity-0 group-hover:opacity-100 transition-opacity">
                              View details <ChevronRight size={12} />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {rows.length === 0 && (
                      <div className="col-span-full rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400 italic">
                        No members yet — add pod rosters to see attendance here.
                      </div>
                    )}
                  </div>

                  {pendingTotal > 0 && (
                    <details className="mt-5 group rounded-2xl border border-amber-100 bg-amber-50/40 overflow-hidden">
                      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <Clock size={14} className="text-amber-600" />
                          Pending approvals
                          <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">{pendingTotal}</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium group-open:hidden">Open</span>
                        <span className="text-[11px] text-slate-500 font-medium hidden group-open:inline">Hide</span>
                      </summary>
                      <div className="border-t border-amber-100 bg-white divide-y divide-slate-100">
                        {adminLeaveRequests.map((lr) => (
                          <div key={lr._id} className="px-4 py-2.5 flex items-center gap-3">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 px-1.5 py-0.5 rounded shrink-0"><ClipboardList size={10} /> Leave</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-semibold text-slate-800 truncate">{lr.userName} · {lr.leaveType}</p>
                              <p className="text-[11px] text-slate-500 truncate">{new Date(lr.leaveDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {lr.subject || "—"}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => handleLeaveAction(lr._id, "approve")} title="Approve" className="p-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"><CheckCircle2 size={14} /></button>
                              <button onClick={() => handleLeaveAction(lr._id, "deny")} title="Deny" className="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 transition-colors"><XCircle size={14} /></button>
                            </div>
                          </div>
                        ))}
                        {adminRequests.map((r) => (
                          <div key={r._id} className="px-4 py-2.5 flex items-center gap-3">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-[#f0e6ff] text-[#6800FF] px-1.5 py-0.5 rounded shrink-0"><FileText size={10} /> Reg</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-semibold text-slate-800 truncate">{r.userName} · {r.punchIn} → {r.punchOut}</p>
                              <p className="text-[11px] text-slate-500 truncate">{r.date} · {r.reason}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => handleRegAction(r._id, "approve")} title="Approve" className="p-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"><CheckCircle2 size={14} /></button>
                              <button onClick={() => handleRegAction(r._id, "reject")} title="Reject" className="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-600 transition-colors"><XCircle size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {isSuperadmin && (leaveHistory.length > 0 || regularizeHistory.length > 0) && (
                    <details className="mt-3 group rounded-2xl border border-slate-100 bg-slate-50/60 overflow-hidden">
                      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <ClipboardList size={14} className="text-slate-500" />
                          Full history
                          <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{leaveHistory.length + regularizeHistory.length}</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium group-open:hidden">Open</span>
                        <span className="text-[11px] text-slate-500 font-medium hidden group-open:inline">Hide</span>
                      </summary>
                      <div className="border-t border-slate-100 bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Leave ({leaveHistory.length})</p>
                          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
                            {leaveHistory.length === 0 ? (
                              <p className="px-3 py-2 text-[11px] text-slate-400 italic">None</p>
                            ) : leaveHistory.map((lr) => (
                              <div key={lr._id} className="px-3 py-2 flex items-center gap-2">
                                <span className={`w-1.5 h-5 rounded-full shrink-0 ${lr.status === "approved" ? "bg-emerald-400" : lr.status === "denied" ? "bg-red-400" : "bg-amber-400"}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-semibold text-slate-800 truncate">{lr.userName} · {lr.leaveType}</p>
                                  <p className="text-[10px] text-slate-500 tabular-nums">{new Date(lr.leaveDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · <span className="capitalize">{lr.status}</span></p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Regularize ({regularizeHistory.length})</p>
                          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
                            {regularizeHistory.length === 0 ? (
                              <p className="px-3 py-2 text-[11px] text-slate-400 italic">None</p>
                            ) : regularizeHistory.map((r) => (
                              <div key={r._id} className="px-3 py-2 flex items-center gap-2">
                                <span className={`w-1.5 h-5 rounded-full shrink-0 ${r.status === "approved" ? "bg-emerald-400" : r.status === "rejected" ? "bg-red-400" : "bg-amber-400"}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-semibold text-slate-800 truncate">{r.userName} · {r.punchIn} → {r.punchOut}</p>
                                  <p className="text-[10px] text-slate-500 tabular-nums">{new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · <span className="capitalize">{r.status}</span></p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      ) : (
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
              Punch available 9:30 AM – 11:59 PM
            </div>
          ) : (
            <button
              onClick={() => handlePunch(isPunchedIn ? "punchOut" : "punchIn")}
              disabled={loading || (!isPunchedIn && !isPunchTimeAllowed)}
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
                <p className="text-lg font-bold text-emerald-600 tabular-nums">{monthRecords.filter((r) => r.status === "present" && !isMissedPunchOut(r)).length}</p>
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
                  const isMissed = missedDateSet.has(dateStr);
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
                          isMissed ? "bg-red-100 text-red-700 border border-red-300" :
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
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-rows-2 gap-4 flex-1">
                {[
                  { icon: ArrowRight, title: "Holiday", desc: null, span: true, extra: <><p className="text-sm font-semibold text-[#6800FF] mb-0.5">{nextHoliday.date.split("-")[2]} {nextHoliday.name}</p><p className="text-sm font-semibold text-slate-900">{nextHoliday.day}</p></>, onClick: () => setShowHolidays(true) },
                  { icon: ArrowUpRight, title: "Leave", desc: null, span: false, extra: (() => {
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
                  })(), onClick: () => { setShowLeavePopup(true); setLeaveStep("select"); setLeaveType(""); setCustomReason(""); setLeaveBody(""); } },
                  { icon: Video, title: "Meeting", desc: null, span: false, extra: (() => {
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
                  const spanClass = card.span ? "sm:row-span-2 h-full" : "";
                  return (
                    <div key={card.title} onClick={onClick} className={`bg-white rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-center ${spanClass} ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}>
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
                    onClick={() => { setShowLeavePopup(true); setLeaveStep("select"); setLeaveType(""); setCustomReason(""); setLeaveBody(""); }}
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
      )}

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
                      const isMissed = missedDateSet.has(dateStr);
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
                              isMissed ? "bg-red-100 text-red-700 border border-red-200 hover:bg-red-200" :
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
                  <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-900" /> Today</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> Present</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-100 border border-red-200" /> Error</div>
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

                        {dayRecord && (() => {
                          const missed = isMissedPunchOut(dayRecord);
                          const badgeClass = missed
                            ? "bg-red-100 text-red-700"
                            : dayRecord.status === "present" ? "bg-emerald-100 text-emerald-700"
                            : dayRecord.status === "half-day" ? "bg-amber-100 text-amber-700"
                            : dayRecord.status === "leave" ? "bg-red-100 text-red-600"
                            : "bg-slate-100 text-slate-500";
                          const badgeLabel = missed ? "error" : dayRecord.status;
                          return (
                            <div className={`rounded-xl p-4 space-y-2 ${missed ? "bg-red-50 border border-red-100" : "bg-slate-50"}`}>
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClass}`}>{badgeLabel}</span>
                                <span className="text-sm font-semibold text-slate-700">{missed ? "missed punch out" : `${Math.floor(dayRecord.totalMinutes / 60)}h ${dayRecord.totalMinutes % 60}m`}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white rounded-lg p-3 border border-slate-100">
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Punch In</p>
                                  <p className="text-base font-bold text-slate-800 tabular-nums">{dayRecord.punchIn ? to12h(dayRecord.punchIn) : "--"}</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-slate-100">
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Punch Out</p>
                                  <p className={`text-base font-bold tabular-nums ${missed ? "text-red-600" : "text-slate-800"}`}>{dayRecord.punchOut ? to12h(dayRecord.punchOut) : missed ? "missing" : "--"}</p>
                                </div>
                              </div>
                              {missed && !dayReg && !showRegForm && (
                                <button
                                  onClick={() => { setShowRegForm(true); setRegForm({ punchIn: dayRecord.punchIn || "", punchOut: "", reason: "" }); }}
                                  className="w-full mt-2 py-2.5 bg-[#6800FF] hover:bg-[#5800DD] text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                  <FileText size={14} /> Regularize Attendance
                                </button>
                              )}
                            </div>
                          );
                        })()}

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

                        {(!dayReg && (!dayRecord || isMissedPunchOut(dayRecord))) && (
                          <>
                            {!showRegForm && !dayRecord ? (
                              <button onClick={() => setShowRegForm(true)} className="w-full py-3 bg-[#6800FF] hover:bg-[#5800DD] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                                <FileText size={16} /> Regularize Attendance
                              </button>
                            ) : showRegForm ? (
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
                            ) : null}
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

                  {leaveType === "Other" && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Specify Reason</label>
                      <input
                        type="text"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Enter your reason for leave..."
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#6800FF] focus:ring-1 focus:ring-[#6800FF]/20"
                      />
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (leaveType && leaveDate && (leaveType !== "Other" || customReason.trim())) {
                        const reason = leaveType === "Other" ? customReason.trim() : leaveType;
                        const approverName = user.approverId ? user.approverId.charAt(0).toUpperCase() + user.approverId.slice(1) : "Admin";
                        const dateFormatted = new Date(leaveDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                        setLeaveBody(`Dear ${approverName},\n\nI am writing to formally request ${reason.toLowerCase()} on ${dateFormatted}.\n\nLeave Type: ${reason}\nDate: ${leaveDate}\n\nI kindly request you to approve my leave application.\n\nThank you.\n\nRegards,\n${user.name}`);
                        setLeaveStep("application");
                      }
                    }}
                    disabled={!leaveType || !leaveDate || (leaveType === "Other" && !customReason.trim())}
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
                        <span className="font-medium text-slate-800">Application for {leaveType === "Other" ? customReason : leaveType}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">Leave Type</p>
                          <p className="text-sm font-bold text-slate-800 mt-0.5">{leaveType === "Other" ? customReason : leaveType}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">Date</p>
                          <p className="text-sm font-bold text-slate-800 mt-0.5">
                            {new Date(leaveDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-slate-400 uppercase">Application</label>
                          <span className="text-[10px] text-slate-400">You can edit this</span>
                        </div>
                        <textarea
                          value={leaveBody}
                          onChange={(e) => setLeaveBody(e.target.value)}
                          rows={10}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed focus:outline-none focus:border-[#6800FF] focus:ring-1 focus:ring-[#6800FF]/20 resize-none"
                        />
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
