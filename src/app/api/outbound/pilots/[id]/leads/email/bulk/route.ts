import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundLead from "@/lib/models/outbound/lead";

export const maxDuration = 60;

interface IncomingResult {
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  personKey?: string;
  domain?: string;
  subject_1?: string; subject1?: string;
  body_1?: string; body1?: string;
  subject_2?: string; subject2?: string;
  body_2?: string; body2?: string;
  subject_3?: string; subject3?: string;
  body_3?: string; body3?: string;
}

interface NormalizedResult {
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  personKey: string;
  domain: string;
  subject1: string; body1: string;
  subject2: string; body2: string;
  subject3: string; body3: string;
}

function pick(obj: IncomingResult, ...keys: (keyof IncomingResult)[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalize(r: IncomingResult): NormalizedResult {
  const firstName = pick(r, "firstName");
  const lastName = pick(r, "lastName");
  const fullName = pick(r, "fullName") || `${firstName} ${lastName}`.trim();
  return {
    email: pick(r, "email").toLowerCase(),
    firstName, lastName, fullName,
    personKey: pick(r, "personKey"),
    domain: pick(r, "domain").toLowerCase(),
    subject1: pick(r, "subject_1", "subject1"),
    body1: pick(r, "body_1", "body1"),
    subject2: pick(r, "subject_2", "subject2"),
    body2: pick(r, "body_2", "body2"),
    subject3: pick(r, "subject_3", "subject3"),
    body3: pick(r, "body_3", "body3"),
  };
}

function isComplete(n: NormalizedResult): boolean {
  return !!(n.subject1 && n.body1 && n.subject2 && n.body2 && n.subject3 && n.body3);
}

interface MatchedLeadDoc {
  _id: { toString(): string };
  pilotId: string;
  accountDomain: string;
  personKey: string;
  email?: string;
  emailStatus?: string;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json();
  const actorRole = String(body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isTest = !!body.isTest;
  const dataPilotId = isTest ? `${id}__test` : id;
  const results = Array.isArray(body.results) ? body.results : null;
  if (!results || results.length === 0) {
    return NextResponse.json({ error: "results array is required" }, { status: 400 });
  }

  const normalized = (results as IncomingResult[]).map(normalize);
  const incomplete = normalized.filter((n) => !isComplete(n));
  const usable = normalized.filter(isComplete);

  if (usable.length === 0) {
    return NextResponse.json({ error: "no entries had all 6 sequence fields", incomplete: incomplete.length, totalReceived: results.length }, { status: 400 });
  }

  const personKeys = usable.map((n) => n.personKey).filter(Boolean);
  const emails = usable.map((n) => n.email).filter(Boolean);
  const fullNames = usable.map((n) => n.fullName.toLowerCase()).filter(Boolean);

  const docs = (await OutboundLead.find({
    pilotId: dataPilotId,
    $or: [
      ...(personKeys.length > 0 ? [{ personKey: { $in: personKeys } }] : []),
      ...(emails.length > 0 ? [{ email: { $in: emails } }] : []),
      ...(fullNames.length > 0 ? [{ fullName: { $regex: fullNames.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), $options: "i" } }] : []),
    ],
  }).lean()) as unknown as MatchedLeadDoc[];

  const byPersonKey = new Map<string, MatchedLeadDoc>();
  const byEmail = new Map<string, MatchedLeadDoc>();
  const byNameDomain = new Map<string, MatchedLeadDoc>();
  for (const d of docs) {
    if (d.personKey) byPersonKey.set(d.personKey, d);
    if (d.email) byEmail.set(d.email.toLowerCase(), d);
    const fullName = String((d as unknown as { fullName?: string }).fullName || "").toLowerCase();
    if (fullName && d.accountDomain) byNameDomain.set(`${fullName}|${d.accountDomain}`, d);
  }

  const updated: { id: string; matchedBy: string }[] = [];
  const unmatched: { input: NormalizedResult; reason: string }[] = [];

  for (const n of usable) {
    let match: MatchedLeadDoc | undefined;
    let matchedBy = "";

    if (n.personKey && byPersonKey.has(n.personKey)) {
      match = byPersonKey.get(n.personKey);
      matchedBy = "personKey";
    } else if (n.email && byEmail.has(n.email)) {
      match = byEmail.get(n.email);
      matchedBy = "email";
    } else if (n.fullName && n.domain && byNameDomain.has(`${n.fullName.toLowerCase()}|${n.domain}`)) {
      match = byNameDomain.get(`${n.fullName.toLowerCase()}|${n.domain}`);
      matchedBy = "name+domain";
    }

    if (!match) {
      unmatched.push({ input: n, reason: "no lead matched on personKey, email, or name+domain" });
      continue;
    }

    const status = String(match.emailStatus || "").toLowerCase();
    const hasUsableEmail = !!match.email && (status === "verified" || status === "likely_to_engage");

    await OutboundLead.updateOne(
      { _id: match._id },
      { $set: {
        subject1: n.subject1, body1: n.body1,
        subject2: n.subject2, body2: n.body2,
        subject3: n.subject3, body3: n.body3,
        shippable: hasUsableEmail,
        validationIssues: hasUsableEmail ? [] : ["no_verified_email"],
        updatedAt: new Date(),
      } },
    );
    updated.push({ id: String(match._id), matchedBy });
  }

  return NextResponse.json({
    ok: true,
    totalReceived: results.length,
    incomplete: incomplete.length,
    matched: updated.length,
    unmatched: unmatched.length,
    matchedBy: {
      personKey: updated.filter((u) => u.matchedBy === "personKey").length,
      email: updated.filter((u) => u.matchedBy === "email").length,
      nameDomain: updated.filter((u) => u.matchedBy === "name+domain").length,
    },
    unmatchedSample: unmatched.slice(0, 10).map((u) => ({ email: u.input.email, fullName: u.input.fullName, reason: u.reason })),
  });
}
