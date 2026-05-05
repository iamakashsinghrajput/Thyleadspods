import type { PhaseState } from "@/lib/outbound/types";

export interface PilotSummary {
  id: string;
  clientName: string;
  pilotName: string;
  status: string;
  phases: PhaseState[];
  totalApolloCredits: number;
  totalLlmTokensIn: number;
  totalLlmTokensOut: number;
  hasCsv: boolean;
  config: Record<string, unknown>;
  inputs: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PilotAccountRow {
  domain: string;
  name: string;
  industry: string;
  country: string;
  employees: number;
  score: number;
  segment: string;
  rank: number;
  keywords: string[];
}

export interface PilotLeadRow {
  accountDomain: string;
  personKey: string;
  companyShort: string;
  industry: string;
  country: string;
  score: number;
  segment: string;
  rank: number;
  fullName: string;
  contactTitle: string;
  email: string;
  emailStatus: string;
  observationAngle: string;
  theirCustomers?: string;
  whatTheySell?: string;
  theirStage?: string;
  topPain?: string;
  valueAngle?: string;
  socialProofMatch?: string[];
  subjectTopic?: string;
  claudePrompt?: string;
  subject1: string;
  body1: string;
  subject2: string;
  body2: string;
  subject3: string;
  body3: string;
  validationIssues: string[];
  shippable: boolean;
  hasPrompt?: boolean;
  hasFullSequence?: boolean;
}

export interface PilotDetail {
  pilot: PilotSummary;
  accounts: PilotAccountRow[];
  leads: PilotLeadRow[];
  testAccounts?: PilotAccountRow[];
  testLeads?: PilotLeadRow[];
}
