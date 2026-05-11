import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Attendance from "@/lib/models/attendance";

const IST_TZ = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

function istNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  return {
    date: `${m.year}-${m.month}-${m.day}`,
    time: `${m.hour}:${m.minute}`,
    epochMs: now.getTime(),
  };
}

const AUTO_PUNCH_OUT_TIME = "18:30";

interface StaleRecord {
  _id: unknown;
  date: string;
  punchIn?: string | null;
  punchOut?: string | null;
  prevMinutes?: number;
  rePunchLog?: string;
}

async function autoClosePastSessions(filter: Record<string, unknown>) {
  const { date: todayDate } = istNow();
  const stale = await Attendance.find({
    ...filter,
    date: { $lt: todayDate },
    punchIn: { $ne: null },
    punchOut: null,
  }).lean<StaleRecord[]>();
  if (stale.length === 0) return;
  for (const r of stale) {
    if (!r.punchIn) continue;
    const inTimeMs = new Date(`${r.date}T${r.punchIn}:00${IST_OFFSET}`).getTime();
    const outTimeMs = new Date(`${r.date}T${AUTO_PUNCH_OUT_TIME}:00${IST_OFFSET}`).getTime();
    const sessionMinutes = Math.max(0, Math.round((outTimeMs - inTimeMs) / 60000));
    const totalMinutes = (r.prevMinutes || 0) + sessionMinutes;
    const status = totalMinutes >= 240 ? "present" : "half-day";
    const autoLog = `Auto punch-out at ${AUTO_PUNCH_OUT_TIME} (missed punch-out)`;
    const newLog = r.rePunchLog ? `${r.rePunchLog}\n${autoLog}` : autoLog;
    await Attendance.updateOne(
      { _id: r._id },
      {
        $set: {
          punchOut: AUTO_PUNCH_OUT_TIME,
          totalMinutes,
          status,
          rePunchLog: newLog,
          autoPunchOut: true,
        },
      },
    );
  }
}

export async function GET(req: NextRequest) {
  await connectDB();
  const userId = req.nextUrl.searchParams.get("userId");
  const date = req.nextUrl.searchParams.get("date");
  const month = req.nextUrl.searchParams.get("month");

  if (userId) await autoClosePastSessions({ userId });

  if (userId && date) {
    const record = await Attendance.findOne({ userId, date }).lean();
    return NextResponse.json({ record: record || null });
  }

  if (userId && month) {
    const records = await Attendance.find({ userId, date: { $regex: `^${month}` } }).sort({ date: 1 }).lean();
    return NextResponse.json({ records });
  }

  if (userId) {
    const records = await Attendance.find({ userId }).sort({ date: -1 }).limit(31).lean();
    return NextResponse.json({ records });
  }

  const all = req.nextUrl.searchParams.get("all");
  if (all === "true") {
    await autoClosePastSessions({});
    const dateFilter = req.nextUrl.searchParams.get("dateFilter");
    const query = dateFilter ? { date: dateFilter } : {};
    const records = await Attendance.find(query).sort({ date: -1, userName: 1 }).limit(200).lean();
    return NextResponse.json({ records });
  }

  return NextResponse.json({ records: [] });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const { userId, userName, action } = await req.json();
  const { date, time, epochMs: nowMs } = istNow();

  if (action === "punchIn") {
    const existing = await Attendance.findOne({ userId, date });
    if (existing && existing.punchIn && !existing.punchOut) {
      return NextResponse.json({ error: "Already punched in today" }, { status: 400 });
    }
    const rePunchIn = !!(existing && existing.punchOut);
    if (rePunchIn && (existing.rePunchCount || 0) >= 2) {
      return NextResponse.json({ error: "Re-punch limit reached (max 2/day)" }, { status: 400 });
    }
    const rePunchLog = rePunchIn ? `Re-punched in at ${time} (previously out at ${existing.punchOut})` : "";
    const prevMinutes = existing?.totalMinutes || 0;
    const rePunchCount = rePunchIn ? (existing.rePunchCount || 0) + 1 : (existing?.rePunchCount || 0);

    const record = await Attendance.findOneAndUpdate(
      { userId, date },
      {
        userId, userName, date, punchIn: time, punchOut: null, status: "present",
        rePunchIn: rePunchIn || existing?.rePunchIn || false,
        rePunchLog: existing?.rePunchLog ? `${existing.rePunchLog}\n${rePunchLog}` : rePunchLog,
        prevMinutes,
        rePunchCount,
      },
      { upsert: true, new: true }
    );
    return NextResponse.json({ record });
  }

  if (action === "punchOut") {
    const record = await Attendance.findOne({ userId, date });
    if (!record || !record.punchIn) {
      return NextResponse.json({ error: "Not punched in" }, { status: 400 });
    }
    if (record.punchOut) {
      return NextResponse.json({ error: "Already punched out" }, { status: 400 });
    }

    const inTimeMs = new Date(`${date}T${record.punchIn}:00${IST_OFFSET}`).getTime();
    const sessionMinutes = Math.max(0, Math.round((nowMs - inTimeMs) / 60000));
    const totalMinutes = (record.prevMinutes || 0) + sessionMinutes;
    const status = totalMinutes >= 240 ? "present" : "half-day";

    record.punchOut = time;
    record.totalMinutes = totalMinutes;
    record.status = status;
    await record.save();
    return NextResponse.json({ record });
  }

  if (action === "markWfh") {
    const record = await Attendance.findOneAndUpdate(
      { userId, date },
      { $set: { isWfh: true } },
      { new: true }
    );
    return NextResponse.json({ record });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
