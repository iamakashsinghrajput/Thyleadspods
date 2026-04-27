import type { ClientStatus } from "@/lib/onboarding/stages";

export interface OnboardingClientDoc {
  id: string;
  name: string;
  contactEmail: string;
  status: ClientStatus;
  ownerEmail: string;
  dataTeamEmail: string;
  icp: string;
  jobTitles: string[];
  competitors: string[];
  notes: string;
  contractSignedAt: string | null;
  formSentAt: string | null;
  formSubmittedAt: string | null;
  accountsSentForApprovalAt: string | null;
  approvedByClientAt: string | null;
  readyAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingAccountDoc {
  id: string;
  clientId: string;
  companyName: string;
  domain: string;
  websiteUrl: string;
  linkedinUrl: string;
  industry: string;
  employeeCount: number;
  source: string;
  approvalStatus: "pending" | "approved" | "rejected";
  rejectionReason: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingContactDoc {
  id: string;
  clientId: string;
  accountId: string;
  companyName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  linkedinUrl: string;
  email: string;
  source: string;
  sheetRow: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
