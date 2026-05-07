export const PHASE_KEYS = [
  "ingest",
  "filter",
  "subset",
  "enrich",
  "score",
  "stakeholder",
  "email_match",
  "research",
  "draft",
  "validate",
  "export",
] as const;

export type PhaseKey = typeof PHASE_KEYS[number];

export interface PhaseDef {
  key: PhaseKey;
  number: number;
  title: string;
  short: string;
  description: string;
  agent: string;
  dependsOn: PhaseKey[];
}

export const PHASE_DEFS: PhaseDef[] = [
  { key: "ingest",      number: 1,  title: "Data ingestion",         short: "Ingest",      description: "Parse uploaded targets, DNC, active customers, past meetings.", agent: "ingest-agent",      dependsOn: [] },
  { key: "filter",      number: 2,  title: "Filter & exclusion",     short: "Filter",      description: "Remove DNC, active customers, past meetings, seller domains.",  agent: "filter-agent",      dependsOn: ["ingest"] },
  { key: "subset",      number: 3,  title: "Smart subset",           short: "Subset",      description: "Pick a 400-600 priority list using TLD + negative-pattern filters.", agent: "subset-agent",  dependsOn: ["filter"] },
  { key: "enrich",      number: 4,  title: "Apollo enrichment",      short: "Enrich",      description: "Bulk-enrich firmographic + behavioral data via Apollo.",         agent: "enrich-agent",      dependsOn: ["subset"] },
  { key: "score",       number: 5,  title: "Account scoring",        short: "Score",       description: "Apply 8-dimension rubric, pick top 50 with industry-diversity guard.", agent: "score-agent",   dependsOn: ["enrich"] },
  { key: "stakeholder", number: 6,  title: "Stakeholder discovery",  short: "People",      description: "Find Champion title at each top-50 account via Apollo.",        agent: "stakeholder-agent", dependsOn: ["score"] },
  { key: "email_match", number: 7,  title: "Email enrichment",       short: "Emails",      description: "Get verified emails via Apollo people bulk match.",            agent: "email-match-agent", dependsOn: ["stakeholder"] },
  { key: "research",    number: 8,  title: "Per-account research",   short: "Research",    description: "Find one observable thing per lead for the body 1 opener.",     agent: "research-agent",    dependsOn: ["email_match"] },
  { key: "draft",       number: 9,  title: "Compile Claude prompts", short: "Prompts",     description: "Build per-lead paste-ready Claude prompts.",                    agent: "prompt-builder",    dependsOn: ["research"] },
  { key: "validate",    number: 10, title: "Validation",             short: "Validate",    description: "Confirm every lead has a complete prompt + verified email.",   agent: "validate-agent",    dependsOn: ["draft"] },
  { key: "export",      number: 11, title: "Leads XLSX",             short: "Export",      description: "Produce the 22-column leads XLSX with claude_prompt column.",  agent: "export-agent",      dependsOn: ["validate"] },
];

export type PhaseStatus = "pending" | "running" | "complete" | "failed" | "blocked";

export interface PhaseState {
  key: PhaseKey;
  status: PhaseStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  inputCount: number;
  outputCount: number;
  metrics: Record<string, number | string>;
  log: string[];
  error: string;
  apolloCreditsUsed: number;
  llmTokensIn: number;
  llmTokensOut: number;
  artifactKey?: string;
}

export interface RawAccount {
  domain: string;
  source: string;
  raw?: Record<string, unknown>;
}

export interface EnrichedAccount {
  domain: string;
  name: string;
  industry: string;
  secondaryIndustries: string[];
  estimatedNumEmployees: number;
  organizationRevenuePrinted: string;
  foundedYear: number;
  city: string;
  state: string;
  country: string;
  ownedByOrganization: string;
  shortDescription: string;
  keywords: string[];
  dhMarketing: number;
  dhEngineering: number;
  dhProductManagement: number;
  dhSales: number;
  headcount6mGrowth: number;
  headcount12mGrowth: number;
  alexaRanking: number;
  linkedinUrl: string;
  publiclyTradedSymbol: string;
}

export interface ScoredAccount extends EnrichedAccount {
  score: number;
  segment: "hot" | "priority" | "active" | "nurture" | "excluded";
  scoreBreakdown: Record<string, number>;
}

export interface Stakeholder {
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  linkedinUrl: string;
  seniority: string;
  pickedReason: string;
  personKey: string;
}

export function makePersonKey(s: { linkedinUrl?: string; fullName?: string; firstName?: string; lastName?: string }): string {
  const li = (s.linkedinUrl || "").toLowerCase()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").trim();
  if (li) return li;
  const name = ((s.fullName || `${s.firstName || ""} ${s.lastName || ""}`) || "").toLowerCase().trim().replace(/\s+/g, "-");
  return name;
}

export interface LeadEmail {
  email: string;
  emailStatus: "verified" | "likely_to_engage" | "unavailable" | "missing";
}

export interface LeadResearch {
  observationAngle: string;
  secondaryObservation: string;
  signalForBody3: string;
  theirCustomers: string;
  whatTheySell: string;
  theirStage: string;
  topPain: string;
  valueAngle: string;
  socialProofMatch: string[];
  subjectTopic: string;
  buyingHypothesis?: string;
  shouldEmail?: "yes" | "maybe" | "no" | "";
  shouldEmailReason?: string;
  confidenceLevel?: "high" | "medium" | "low" | "";
  buyerSignalScore?: number;
  evidenceList?: string[];
  socialAngle?: string;
  personEvidence?: string[];
  icpRole?: string;
}

export interface LeadDraft {
  subject1: string;
  body1: string;
  subject2: string;
  body2: string;
  subject3: string;
  body3: string;
}

export interface ValidationIssue {
  rule: string;
  field: string;
  detail: string;
  leadKey: string;
}
