// Google Sheets reader. The platform doesn't authenticate to a user's Google
// account — instead the Data Team shares the sheet as "anyone with the link
// can view" and pastes the URL or sheet ID. We fetch the public CSV export.
//
// The sheet is expected to have a header row. Recognized column names
// (case-insensitive, ignores spaces/underscores):
//   company / company_name / account
//   first_name / firstname
//   last_name / lastname / last
//   job_title / title / position / role
//   linkedin / linkedin_url / linkedin_profile
//   email
//   notes

export interface SheetContactRow {
  rowNumber: number;
  companyName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  linkedinUrl: string;
  email: string;
  notes: string;
}

export interface SheetParseResult {
  rows: SheetContactRow[];
  headers: string[];
  warnings: string[];
}

// Accepts:
//   https://docs.google.com/spreadsheets/d/<id>/edit#gid=<gid>
//   https://docs.google.com/spreadsheets/d/<id>/edit?gid=<gid>
//   <id> (44-char alphanumeric)
// Returns { id, gid }.
export function parseSheetSource(input: string): { id: string; gid: string } | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const id = urlMatch ? urlMatch[1] : (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed) ? trimmed : null);
  if (!id) return null;
  const gidMatch = trimmed.match(/[?#&]gid=([0-9]+)/);
  return { id, gid: gidMatch ? gidMatch[1] : "0" };
}

export function csvExportUrl(id: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export async function fetchSheetCsv(id: string, gid: string): Promise<string> {
  const url = csvExportUrl(id, gid);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    if (res.status === 404 || res.status === 401 || res.status === 403) {
      throw new Error("Sheet is not publicly readable. Share it as 'Anyone with the link can view'.");
    }
    throw new Error(`Sheet fetch failed (${res.status}). Check the URL is correct.`);
  }
  return await res.text();
}

// Minimal CSV parser — handles quoted fields with embedded commas + escaped quotes.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const COLUMN_ALIASES: Record<keyof Omit<SheetContactRow, "rowNumber">, string[]> = {
  companyName: ["company", "companyname", "account", "accountname", "organization", "organisation"],
  firstName: ["firstname", "first", "fname"],
  lastName: ["lastname", "last", "lname", "surname"],
  jobTitle: ["jobtitle", "title", "position", "role"],
  linkedinUrl: ["linkedin", "linkedinurl", "linkedinprofile", "li"],
  email: ["email", "emailaddress", "emailid"],
  notes: ["notes", "comment", "comments"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pickColumns(headers: string[]): Record<keyof Omit<SheetContactRow, "rowNumber">, number> {
  const norm = headers.map(normalize);
  const out = {} as Record<keyof Omit<SheetContactRow, "rowNumber">, number>;
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [keyof typeof COLUMN_ALIASES, string[]][]) {
    out[field] = -1;
    for (const a of aliases) {
      const idx = norm.indexOf(a);
      if (idx !== -1) { out[field] = idx; break; }
    }
  }
  return out;
}

export function parseCsv(csv: string): SheetParseResult {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], headers: [], warnings: ["Sheet is empty."] };

  const headers = parseCsvLine(lines[0]);
  const cols = pickColumns(headers);
  const warnings: string[] = [];
  if (cols.companyName === -1) warnings.push("No 'Company' column detected — contacts won't link to accounts.");
  if (cols.firstName === -1) warnings.push("No 'First name' column detected.");
  if (cols.lastName === -1) warnings.push("No 'Last name' column detected.");
  if (cols.jobTitle === -1) warnings.push("No 'Job title' column detected.");
  if (cols.linkedinUrl === -1) warnings.push("No 'LinkedIn' column detected.");

  const rows: SheetContactRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: SheetContactRow = {
      rowNumber: i + 1,
      companyName: cols.companyName >= 0 ? (cells[cols.companyName] || "") : "",
      firstName: cols.firstName >= 0 ? (cells[cols.firstName] || "") : "",
      lastName: cols.lastName >= 0 ? (cells[cols.lastName] || "") : "",
      jobTitle: cols.jobTitle >= 0 ? (cells[cols.jobTitle] || "") : "",
      linkedinUrl: cols.linkedinUrl >= 0 ? (cells[cols.linkedinUrl] || "") : "",
      email: cols.email >= 0 ? (cells[cols.email] || "") : "",
      notes: cols.notes >= 0 ? (cells[cols.notes] || "") : "",
    };
    // Skip rows that are completely empty across our columns of interest.
    if (!row.companyName && !row.firstName && !row.lastName && !row.linkedinUrl) continue;
    rows.push(row);
  }
  return { rows, headers, warnings };
}
