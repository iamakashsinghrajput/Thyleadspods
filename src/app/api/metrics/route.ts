import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import ClientMetric from "@/lib/models/client-metric";

export async function GET() {
  await connectDB();
  const docs = await ClientMetric.find({}).lean();
  const map: Record<string, unknown[]> = {};
  for (const d of docs as unknown as Array<Record<string, unknown> & { projectId: string }>) {
    const { projectId, _id, __v, createdAt, updatedAt, ...rest } = d;
    void _id; void __v; void createdAt; void updatedAt;
    (map[projectId] ||= []).push(rest);
  }
  return NextResponse.json({ metrics: map });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const { projectId, date, month, year, leads, accounts } = await req.json();
  if (!projectId || !date || !month || typeof year !== "number") {
    return NextResponse.json({ error: "projectId, date, month, year required" }, { status: 400 });
  }

  const existing = await ClientMetric.findOne({ projectId, month, year });
  if (!existing) {
    await ClientMetric.create({
      projectId,
      clientId: projectId,
      month,
      year,
      dailyMetrics: [{ date, leadsUploaded: leads ?? 0, accountsMined: accounts ?? 0 }],
    });
    return NextResponse.json({ ok: true });
  }

  existing.dailyMetrics.push({ date, leadsUploaded: leads ?? 0, accountsMined: accounts ?? 0 });
  await existing.save();
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const { projectId, month, year, date, data } = await req.json();
  if (!projectId || !month || typeof year !== "number" || !date) {
    return NextResponse.json({ error: "projectId, month, year, date required" }, { status: 400 });
  }
  const doc = await ClientMetric.findOne({ projectId, month, year });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  const target = doc.dailyMetrics.find((m) => m.date === date);
  if (!target) return NextResponse.json({ error: "date not found" }, { status: 404 });
  if (typeof data.leadsUploaded === "number") target.leadsUploaded = data.leadsUploaded;
  if (typeof data.accountsMined === "number") target.accountsMined = data.accountsMined;
  if (typeof data.date === "string") target.date = data.date;
  await doc.save();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const projectId = req.nextUrl.searchParams.get("projectId");
  const month = req.nextUrl.searchParams.get("month");
  const yearStr = req.nextUrl.searchParams.get("year");
  const date = req.nextUrl.searchParams.get("date");
  if (!projectId || !month || !yearStr || !date) {
    return NextResponse.json({ error: "projectId, month, year, date required" }, { status: 400 });
  }
  const year = Number(yearStr);
  await ClientMetric.updateOne(
    { projectId, month, year },
    { $pull: { dailyMetrics: { date } } }
  );
  return NextResponse.json({ ok: true });
}
