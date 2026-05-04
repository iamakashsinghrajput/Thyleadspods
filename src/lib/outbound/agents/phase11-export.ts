import type { PhaseState } from "../types";

export interface ExportOutput {
  csv: string;
  rowCount: number;
}

export interface ClaudePasteLeadMeta {
  email: string;
  emailStatus: string;
  firstName: string;
  lastName: string;
  fullName: string;
  companyShort: string;
  companyFull: string;
  domain: string;
  industry: string;
  employees: number;
  country: string;
  contactTitle: string;
  contactLinkedinUrl: string;
  companyLinkedinUrl: string;
  score: number;
  segment: string;
  observationAngle: string;
  topPain: string;
  valueAngle: string;
  socialProofMatch: string;
  subjectTopic: string;
  claudePrompt: string;
  subject1: string;
  body1: string;
  subject2: string;
  body2: string;
  subject3: string;
  body3: string;
}

const HEADERS = [
  "email", "email_status", "first_name", "last_name", "full_name",
  "company_short", "company_full", "domain",
  "industry", "employees", "country",
  "contact_title", "contact_linkedin_url", "company_linkedin_url",
  "score", "segment",
  "observation_angle", "top_pain", "value_angle", "social_proof_match", "subject_topic",
  "subject_1", "body_1", "subject_2", "body_2", "subject_3", "body_3",
  "claude_prompt",
];

function escapeCsv(v: string | number | undefined): string {
  const s = (v ?? "").toString();
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export interface ClaudePasteExportInput {
  leads: ClaudePasteLeadMeta[];
}

export function exportClaudePasteAgent(input: ClaudePasteExportInput): { output: ExportOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount"> } {
  const log: string[] = [];
  const lines = [HEADERS.join(",")];
  let written = 0;
  let withEmail = 0;
  let withPrompt = 0;
  let withDrafts = 0;
  for (const l of input.leads) {
    if (l.email) withEmail++;
    if (l.claudePrompt) withPrompt++;
    if (l.body1 && l.body2 && l.body3) withDrafts++;
    lines.push([
      l.email, l.emailStatus, l.firstName, l.lastName, l.fullName,
      l.companyShort, l.companyFull, l.domain,
      l.industry, l.employees, l.country,
      l.contactTitle, l.contactLinkedinUrl, l.companyLinkedinUrl,
      l.score, l.segment,
      l.observationAngle, l.topPain, l.valueAngle, l.socialProofMatch, l.subjectTopic,
      l.subject1, l.body1, l.subject2, l.body2, l.subject3, l.body3,
      l.claudePrompt,
    ].map(escapeCsv).join(","));
    written++;
  }
  const csv = lines.join("\n");
  log.push(`Wrote ${written} CSV rows (${HEADERS.length} columns).`);
  log.push(`${withEmail} rows have a verified/likely email · ${withPrompt} have a Claude prompt · ${withDrafts} have all 3 drafts populated.`);
  log.push(`Workflow: use Paste mode in the Leads tab to fill subject_1/body_1…subject_3/body_3, then export.`);
  return {
    output: { csv, rowCount: written },
    state: {
      log,
      metrics: { rows: written, bytes: csv.length, withEmail, withPrompt, withDrafts },
      inputCount: input.leads.length,
      outputCount: written,
    },
  };
}
