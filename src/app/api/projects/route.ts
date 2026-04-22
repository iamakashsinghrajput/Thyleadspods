import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/project";

export async function GET() {
  await connectDB();
  const projects = await Project.find({}).sort({ id: 1 }).lean();
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  if (!body?.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const project = await Project.findOneAndUpdate(
    { id: body.id },
    { $set: body },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return NextResponse.json({ project });
}

export async function PATCH(req: NextRequest) {
  await connectDB();
  const { id, data } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const project = await Project.findOneAndUpdate({ id }, { $set: data }, { new: true }).lean();
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ project });
}
