import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundLead from "@/lib/models/outbound/lead";

interface SequenceFields {
  subject1: string;
  body1: string;
  subject2: string;
  body2: string;
  subject3: string;
  body3: string;
}

function stripFences(s: string): string {
  let t = s.trim();
  t = t.replace(/^```(?:json)?\s*/i, "");
  t = t.replace(/```\s*$/i, "");
  return t.trim();
}

function pickFirstObject(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

function pickField(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function parseSequence(raw: string): { ok: true; fields: SequenceFields } | { ok: false; error: string } {
  if (!raw || !raw.trim()) return { ok: false, error: "Empty input" };
  let body = stripFences(raw);
  body = pickFirstObject(body);
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch (e) { return { ok: false, error: `Could not parse JSON: ${e instanceof Error ? e.message : "unknown"}` }; }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "JSON did not contain an object" };
  const obj = parsed as Record<string, unknown>;
  const fields: SequenceFields = {
    subject1: pickField(obj, ["subject_1", "subject1", "Subject 1", "subjectOne"]),
    body1: pickField(obj, ["body_1", "body1", "Body 1", "bodyOne"]),
    subject2: pickField(obj, ["subject_2", "subject2", "Subject 2", "subjectTwo"]),
    body2: pickField(obj, ["body_2", "body2", "Body 2", "bodyTwo"]),
    subject3: pickField(obj, ["subject_3", "subject3", "Subject 3", "subjectThree"]),
    body3: pickField(obj, ["body_3", "body3", "Body 3", "bodyThree"]),
  };
  const missing: string[] = [];
  if (!fields.subject1) missing.push("subject_1");
  if (!fields.body1) missing.push("body_1");
  if (!fields.subject2) missing.push("subject_2");
  if (!fields.body2) missing.push("body_2");
  if (!fields.subject3) missing.push("subject_3");
  if (!fields.body3) missing.push("body_3");
  if (missing.length > 0) return { ok: false, error: `Missing fields: ${missing.join(", ")}` };
  return { ok: true, fields };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json();
  const accountDomain = String(body.accountDomain || "").toLowerCase().trim();
  const personKey = String(body.personKey || "").trim();
  const raw = String(body.raw || "");
  if (!accountDomain || !personKey) return NextResponse.json({ error: "accountDomain and personKey required" }, { status: 400 });

  const parsed = parseSequence(raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await OutboundLead.updateOne(
    { pilotId: id, accountDomain, personKey },
    { $set: { ...parsed.fields, shippable: true, validationIssues: [], updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  return NextResponse.json({ ok: true, fields: parsed.fields });
}
