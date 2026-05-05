import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";
import OutboundLead from "@/lib/models/outbound/lead";
import OutboundAccount from "@/lib/models/outbound/account";

interface PilotShape {
  pilotName?: string;
  clientName?: string;
}

const HEADERS = [
  "email", "first_name", "last_name", "company_short",
  "subject_1", "body_1", "subject_2", "body_2", "subject_3", "body_3",
  "domain", "company_full", "industry", "employees", "country",
  "contact_title", "contact_linkedin_url", "company_linkedin_url",
  "score", "segment", "email_status",
  "observation_angle", "top_pain", "value_angle", "social_proof_match", "subject_topic",
  "claude_prompt",
];

function clientSlug(s: string): string {
  const slug = (s || "vwo").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return slug || "client";
}

function str(v: unknown): string { return typeof v === "string" ? v : ""; }
function num(v: unknown): number { return typeof v === "number" ? v : Number(v) || 0; }
function arr(v: unknown): string[] { return Array.isArray(v) ? v.map(String) : []; }

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const isTest = req.nextUrl.searchParams.get("test") === "1";
  const dataPilotId = isTest ? `${id}__test` : id;
  const doc = await OutboundPilot.findById(id).lean<PilotShape>();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [leadDocs, accountDocs] = await Promise.all([
    OutboundLead.find({ pilotId: dataPilotId }).sort({ rank: 1 }).lean(),
    OutboundAccount.find({ pilotId: dataPilotId }).select({ domain: 1, linkedinUrl: 1 }).lean(),
  ]);

  if (leadDocs.length === 0) {
    return NextResponse.json({ error: "no leads to export" }, { status: 409 });
  }

  const accountLinkedinByDomain = new Map<string, string>();
  for (const a of accountDocs as Array<Record<string, unknown>>) {
    accountLinkedinByDomain.set(str(a.domain).toLowerCase(), str(a.linkedinUrl));
  }

  const rows: (string | number)[][] = [HEADERS];
  for (const l of leadDocs as Array<Record<string, unknown>>) {
    const domain = str(l.accountDomain).toLowerCase();
    rows.push([
      str(l.email),
      str(l.firstName),
      str(l.lastName),
      str(l.companyShort),
      str(l.subject1),
      str(l.body1),
      str(l.subject2),
      str(l.body2),
      str(l.subject3),
      str(l.body3),
      domain,
      str(l.companyFull),
      str(l.industry),
      num(l.employees),
      str(l.country),
      str(l.contactTitle),
      str(l.contactLinkedinUrl),
      accountLinkedinByDomain.get(domain) || "",
      num(l.score),
      str(l.segment),
      str(l.emailStatus),
      str(l.observationAngle),
      str(l.topPain),
      str(l.valueAngle),
      arr(l.socialProofMatch).join(" · "),
      str(l.subjectTopic),
      str(l.claudePrompt),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  const colWidths: { wch: number }[] = HEADERS.map((h) => {
    if (h.startsWith("body_")) return { wch: 60 };
    if (h.startsWith("subject_")) return { wch: 22 };
    if (h === "observation_angle" || h === "top_pain" || h === "value_angle") return { wch: 50 };
    if (h === "claude_prompt") return { wch: 80 };
    if (h === "email" || h.endsWith("_linkedin_url")) return { wch: 34 };
    if (h === "domain" || h === "company_short" || h === "company_full") return { wch: 24 };
    if (h === "industry" || h === "country" || h === "contact_title") return { wch: 20 };
    return { wch: 14 };
  });
  ws["!cols"] = colWidths;

  const ref = ws["!ref"];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;
        if (R === 0) {
          cell.s = { font: { bold: true }, alignment: { vertical: "top", horizontal: "left" } };
        } else {
          const header = HEADERS[C];
          const wrap = header && (header.startsWith("body_") || header.startsWith("subject_") || header === "observation_angle" || header === "top_pain" || header === "value_angle" || header === "claude_prompt");
          if (wrap) cell.s = { alignment: { wrapText: true, vertical: "top" } };
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "smartlead");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `${clientSlug(doc.clientName || "vwo")}_pilot_smartlead_ready.xlsx`;

  return new NextResponse(new Uint8Array(buf as Buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
