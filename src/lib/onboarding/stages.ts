// Linear stage machine for the onboarding flow. Single status field on the
// client doc; the UI maps to stage labels + colors + next-action hints.

export type ClientStatus =
  | "new_client"             // just created — needs the form to be sent
  | "form_pending"           // form sent, waiting on the client to fill it
  | "form_received"          // client submitted; GTME starts finding accounts
  | "accounts_in_progress"   // GTME is sourcing accounts (Apollo + manual)
  | "awaiting_approval"      // accounts sent to client for verification
  | "data_team_extracting"   // approved; Data Team enriches via Sheets/manual
  | "ready";                 // all contacts uploaded; ready for campaigns

export interface StageDef {
  key: ClientStatus;
  label: string;
  shortLabel: string;
  description: string;
  ownerHint: string;
}

export const STAGES: StageDef[] = [
  { key: "new_client", label: "New client", shortLabel: "New", description: "Just created. Send the onboarding form.", ownerHint: "AM" },
  { key: "form_pending", label: "Form pending", shortLabel: "Form", description: "Form was sent. Awaiting the client's submission.", ownerHint: "Client" },
  { key: "form_received", label: "Form received", shortLabel: "Brief", description: "Client filled the form. GTM Engineer starts finding accounts.", ownerHint: "GTME" },
  { key: "accounts_in_progress", label: "Accounts in progress", shortLabel: "Discovery", description: "GTME is sourcing accounts via Apollo + manual research.", ownerHint: "GTME" },
  { key: "awaiting_approval", label: "Awaiting client approval", shortLabel: "Approval", description: "Account list sent to the client. Waiting for them to verify.", ownerHint: "Client" },
  { key: "data_team_extracting", label: "Data Team extracting", shortLabel: "Enrichment", description: "Client approved. Data Team is enriching contacts (Sales Nav → Sheet → import).", ownerHint: "Data Team" },
  { key: "ready", label: "Ready", shortLabel: "Ready", description: "Contacts enriched. Campaign-ready.", ownerHint: "—" },
];

export const STAGE_ORDER: ClientStatus[] = STAGES.map((s) => s.key);

export function stageIndex(status: ClientStatus): number {
  return STAGE_ORDER.indexOf(status);
}
