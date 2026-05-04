// Apollo wrapper. Real call when APOLLO_API_KEY is set; otherwise returns
// mock results so the GTME UI is functional during dev.

export interface ApolloSearchInput {
  // Free-form ICP description from the client's onboarding form.
  industry?: string[];
  jobTitles?: string[];
  geos?: string[];
  employeeCountMin?: number;
  employeeCountMax?: number;
  perPage?: number;
}

export interface ApolloAccountResult {
  companyName: string;
  domain: string;
  websiteUrl: string;
  linkedinUrl: string;
  industry: string;
  employeeCount: number;
  source: "apollo" | "apollo-mock";
}

const API = "https://api.apollo.io/v1";

export function isApolloLive(): boolean {
  return !!process.env.APOLLO_API_KEY;
}

export async function searchAccounts(input: ApolloSearchInput): Promise<ApolloAccountResult[]> {
  if (!isApolloLive()) return mockResults(input);
  const apiKey = process.env.APOLLO_API_KEY!;

  // First attempt: include keyword tags from the ICP. If that returns nothing
  // (common with free-form ICP descriptions), retry without filters.
  const tags = (input.industry || []).flatMap((s) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean));
  let rows = await fetchOrgs(apiKey, input, tags);
  if (rows.length === 0 && tags.length > 0) {
    rows = await fetchOrgs(apiKey, input, []);
  }
  return rows;
}

interface ApolloOrgRow {
  name?: string;
  primary_domain?: string;
  website_url?: string;
  linkedin_url?: string;
  industry?: string;
  estimated_num_employees?: number;
}

async function fetchOrgs(apiKey: string, input: ApolloSearchInput, tags: string[]): Promise<ApolloAccountResult[]> {
  const reqBody: Record<string, unknown> = {
    page: 1,
    per_page: Math.min(input.perPage ?? 25, 100),
  };
  if (input.employeeCountMin != null && input.employeeCountMax != null) {
    reqBody.organization_num_employees_ranges = [`${input.employeeCountMin},${input.employeeCountMax}`];
  }
  if (input.geos && input.geos.length > 0) reqBody.organization_locations = input.geos;
  if (tags.length > 0) reqBody.q_organization_keyword_tags = tags;

  const res = await fetch(`${API}/organizations/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(reqBody),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`apollo ${res.status}: ${errText.slice(0, 300) || res.statusText}`);
  }
  // Defensive: accept either "organizations" or "accounts" depending on plan.
  const data = (await res.json()) as { organizations?: ApolloOrgRow[]; accounts?: ApolloOrgRow[] };
  const orgs = data.organizations || data.accounts || [];
  return orgs.map((o) => ({
    companyName: o.name || "",
    domain: o.primary_domain || "",
    websiteUrl: o.website_url || "",
    linkedinUrl: o.linkedin_url || "",
    industry: o.industry || "",
    employeeCount: o.estimated_num_employees || 0,
    source: "apollo" as const,
  })).filter((r) => r.companyName);
}

function mockResults(input: ApolloSearchInput): ApolloAccountResult[] {
  const industry = (input.industry?.[0] || "B2B SaaS").toLowerCase();
  const rows: ApolloAccountResult[] = [
    { companyName: "Mockwell Industries", domain: "mockwell.com", websiteUrl: "https://mockwell.com", linkedinUrl: "https://linkedin.com/company/mockwell", industry, employeeCount: 420, source: "apollo-mock" },
    { companyName: "Phantom Foods", domain: "phantomfoods.com", websiteUrl: "https://phantomfoods.com", linkedinUrl: "https://linkedin.com/company/phantomfoods", industry, employeeCount: 1100, source: "apollo-mock" },
    { companyName: "Ledger Logistics", domain: "ledgerlog.com", websiteUrl: "https://ledgerlog.com", linkedinUrl: "https://linkedin.com/company/ledger-logistics", industry, employeeCount: 230, source: "apollo-mock" },
    { companyName: "Northstar Capital", domain: "northstar.capital", websiteUrl: "https://northstar.capital", linkedinUrl: "https://linkedin.com/company/northstar-capital", industry, employeeCount: 150, source: "apollo-mock" },
    { companyName: "Helix Bio", domain: "helixbio.com", websiteUrl: "https://helixbio.com", linkedinUrl: "https://linkedin.com/company/helixbio", industry, employeeCount: 800, source: "apollo-mock" },
  ];
  return rows.slice(0, input.perPage ?? 25);
}
