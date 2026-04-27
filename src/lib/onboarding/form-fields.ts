// Onboarding-form questions. Single source of truth — public form, submission
// API, and the admin "view answers" panel all read from this file.

export type FieldType = "text" | "textarea" | "tags" | "number";

export interface OnboardingFieldDef {
  key: string;
  label: string;
  helper?: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
}

export interface OnboardingAnswers {
  companyOneLine?: string;
  icp?: string;
  jobTitles?: string[];
  competitors?: string[];
  existingCustomers?: string[];
  targetGeos?: string[];
  volumeForecast?: number;
  brandDosAndDonts?: string;
}

export const ONBOARDING_FIELDS: OnboardingFieldDef[] = [
  {
    key: "companyOneLine",
    label: "What does your company do — one sentence",
    helper: "How would you describe your product to someone in your buyer's role.",
    type: "textarea",
    required: true,
    placeholder: "e.g. We help mid-market manufacturers digitise their factory floor.",
  },
  {
    key: "icp",
    label: "Ideal Customer Profile (ICP)",
    helper: "Size band, vertical, geos. The clearer this is, the better the account list will match.",
    type: "textarea",
    required: true,
    placeholder: "200–2,000 employees · Manufacturing / Industrial · NA + EU · skip pre-revenue",
  },
  {
    key: "jobTitles",
    label: "Target job titles",
    helper: "Add one or more. The Data Team uses these when sourcing contacts on LinkedIn Sales Nav.",
    type: "tags",
    required: true,
    placeholder: "VP Operations, Director of Manufacturing, Head of Supply Chain",
  },
  {
    key: "competitors",
    label: "Top 3 competitors",
    helper: "Comma-separated. We use these to position the messaging.",
    type: "tags",
    required: false,
    placeholder: "Siemens, Rockwell, Honeywell",
  },
  {
    key: "existingCustomers",
    label: "Existing customers (we'll auto-suppress them from outreach)",
    helper: "5–10 names. So we never email someone you already work with.",
    type: "tags",
    required: false,
    placeholder: "Boeing, GE, Lockheed",
  },
  {
    key: "targetGeos",
    label: "Target geographies",
    helper: "Country or region codes. e.g. US, UK, IN.",
    type: "tags",
    required: false,
    placeholder: "US, UK, IN, AE",
  },
  {
    key: "volumeForecast",
    label: "Volume forecast (target leads / month)",
    helper: "Used to size the account list and the team plan.",
    type: "number",
    required: false,
    placeholder: "e.g. 500",
  },
  {
    key: "brandDosAndDonts",
    label: "Brand do's and don'ts",
    helper: "Tone, banned phrases, anything legal/PR sensitive.",
    type: "textarea",
    required: false,
    placeholder: "DO: pragmatic, ROI-first. DON'T: 'AI-powered', 'next-gen', or any consumer-tech hype.",
  },
];

export function isAnswered(field: OnboardingFieldDef, value: unknown): boolean {
  if (field.type === "tags") return Array.isArray(value) && value.length > 0;
  if (field.type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === "string" && value.trim().length > 0;
}
