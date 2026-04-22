import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import ClientDetail from "@/lib/models/client-detail";

export async function GET() {
  await connectDB();
  const details = await ClientDetail.find({}).lean();
  const map: Record<string, unknown[]> = {};
  for (const d of details as unknown as Array<Record<string, unknown> & { projectId: string }>) {
    const { projectId, _id, __v, createdAt, updatedAt, ...rest } = d;
    void _id; void __v; void createdAt; void updatedAt;
    (map[projectId] ||= []).push(rest);
  }
  return NextResponse.json({ details: map });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const { projectId, detail } = await req.json();
  if (!projectId || !detail?.id) {
    return NextResponse.json({ error: "projectId and detail.id required" }, { status: 400 });
  }
  await ClientDetail.findOneAndUpdate(
    { projectId, id: detail.id },
    { $set: { projectId, ...detail } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const { projectId, detailId, data } = await req.json();
  if (!projectId || !detailId) {
    return NextResponse.json({ error: "projectId and detailId required" }, { status: 400 });
  }
  await ClientDetail.findOneAndUpdate({ projectId, id: detailId }, { $set: data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const projectId = req.nextUrl.searchParams.get("projectId");
  const detailId = req.nextUrl.searchParams.get("detailId");
  if (!projectId || !detailId) {
    return NextResponse.json({ error: "projectId and detailId required" }, { status: 400 });
  }
  await ClientDetail.deleteOne({ projectId, id: detailId });
  return NextResponse.json({ ok: true });
}
