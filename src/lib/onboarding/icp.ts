// Translate the client's free-form onboarding-form answers into structured
// Apollo search filters. With a live LLM key we use the model to extract
// industry keywords, employee-count band, geos, and search keywords. Without
// a key we fall back to a regex-based heuristic.

import { llm, extractJson } from "./llm";
import type { ApolloSearchInput } from "./apollo";

export interface IcpFormPayload {
  companyName: string;
  companyOneLine: string;
  icp: string;                       // free-form ICP description from the form
  jobTitles: string[];
  competitors: string[];
  existingCustomers: string[];
  targetGeos: string[];
  volumeForecast: number;
}

export interface ResolvedApolloFilters extends ApolloSearchInput {
  // Echoed back so the UI can show "Searched for: …".
  resolvedFrom: "llm" | "heuristic" | "passthrough";
  rationale: string;
  llmProvider?: string;
  llmModel?: string;
}

interface LlmFilterShape {
  keyword_tags?: string[];
  employee_count_min?: number;
  employee_count_max?: number;
  geos?: string[];
  rationale?: string;
}

const SYSTEM_PROMPT = `You translate a free-form B2B Ideal Customer Profile (ICP) into structured Apollo search filters.

Output ONLY valid JSON with these keys:
- keyword_tags: array of 3–8 short industry/keyword phrases Apollo can match (lowercase, e.g. "fintech", "logistics", "b2b saas", "compliance"). Avoid generic words like "software".
- employee_count_min: integer (lowest number of employees that fits the ICP — set to 1 if not implied)
- employee_count_max: integer (highest — set to 10000 if "enterprise" or unbounded)
- geos: array of country names matching Apollo's expected format (e.g. "United States", "United Kingdom", "India", "Germany"). Map ISO codes (US, UK, IN) to full names.
- rationale: ONE sentence explaining the picks.

Skip pre-revenue / sub-50 emp companies unless ICP explicitly asks for them.`;

export async function buildApolloFiltersFromForm(form: IcpFormPayload, perPage = 25): Promise<ResolvedApolloFilters> {
  const userPayload = {
    company: form.companyName,
    company_does: form.companyOneLine,
    icp_description: form.icp,
    target_titles: form.jobTitles,
    competitors: form.competitors,
    existing_customers: form.existingCustomers,
    stated_geos: form.targetGeos,
  };

  const mockOutput = JSON.stringify(heuristicFilters(form));

  const result = await llm({
    system: SYSTEM_PROMPT,
    user: `# Build Apollo filters\n\nForm answers:\n\n\`\`\`json\n${JSON.stringify(userPayload, null, 2)}\n\`\`\``,
    jsonOnly: true,
    maxTokens: 500,
    mockOutput,
  });

  const parsed = extractJson<LlmFilterShape>(result.text, {});

  // If the LLM returned nothing usable, fall back to the heuristic.
  if (!parsed.keyword_tags || parsed.keyword_tags.length === 0) {
    const h = JSON.parse(mockOutput) as LlmFilterShape;
    return {
      industry: h.keyword_tags || [],
      geos: h.geos || form.targetGeos,
      employeeCountMin: h.employee_count_min,
      employeeCountMax: h.employee_count_max,
      perPage,
      resolvedFrom: result.provider === "mock" ? "heuristic" : "passthrough",
      rationale: h.rationale || "Fell back to heuristic filters.",
      llmProvider: result.provider,
      llmModel: result.model,
    };
  }

  return {
    industry: parsed.keyword_tags,
    geos: parsed.geos && parsed.geos.length > 0 ? parsed.geos : form.targetGeos,
    employeeCountMin: parsed.employee_count_min,
    employeeCountMax: parsed.employee_count_max,
    perPage,
    resolvedFrom: result.provider === "mock" ? "heuristic" : "llm",
    rationale: parsed.rationale || "(no rationale returned)",
    llmProvider: result.provider,
    llmModel: result.model,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic fallback — used when no LLM key is set OR when the LLM response
// can't be parsed. Best-effort regex on the ICP string.
// ─────────────────────────────────────────────────────────────────────────────
function heuristicFilters(form: IcpFormPayload): LlmFilterShape {
  const icp = (form.icp || "").toLowerCase();
  const oneLine = (form.companyOneLine || "").toLowerCase();
  const corpus = `${icp} ${oneLine}`;

  // Pull keyword candidates: split on commas/slashes/pipes, drop short words,
  // dedupe, cap to 8.
  const keywordCandidates = icp
    .split(/[,/|·]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && s.length <= 40)
    .filter((s) => !/^\d+/.test(s));
  const tags = Array.from(new Set(keywordCandidates)).slice(0, 8);

  // Employee count band — try to extract "200–2000", "100-500", "200 to 2000".
  let min = 50;
  let max = 5000;
  const range = corpus.match(/(\d{2,5})\s*[–\-to]+\s*(\d{2,5})/);
  if (range) {
    min = Math.max(1, Number(range[1]));
    max = Math.min(50000, Number(range[2]));
  } else if (/enterprise|fortune|global 2000/.test(corpus)) {
    min = 1000; max = 50000;
  } else if (/mid[- ]market/.test(corpus)) {
    min = 200; max = 2000;
  } else if (/smb|small business|startup/.test(corpus)) {
    min = 10; max = 200;
  }

  // Geos: prefer the structured tag list. If empty, scan the ICP text.
  const ISO: Record<string, string> = {
    US: "United States", USA: "United States",
    UK: "United Kingdom", GB: "United Kingdom",
    IN: "India", DE: "Germany", FR: "France", JP: "Japan",
    AU: "Australia", CA: "Canada", AE: "United Arab Emirates",
    SG: "Singapore", BR: "Brazil",
  };
  const geosRaw = form.targetGeos.length > 0 ? form.targetGeos : extractGeosFromText(corpus);
  const geos = geosRaw.map((g) => ISO[g.toUpperCase()] || g);

  return {
    keyword_tags: tags.length > 0 ? tags : ["b2b"],
    employee_count_min: min,
    employee_count_max: max,
    geos,
    rationale: `Heuristic: parsed ${tags.length} tags from ICP, employee band ${min}-${max}, geos from ${form.targetGeos.length > 0 ? "form" : "text"}.`,
  };
}

function extractGeosFromText(text: string): string[] {
  const found: string[] = [];
  const list: Array<[RegExp, string]> = [
    [/\b(us|usa|united states|america)\b/, "United States"],
    [/\b(uk|britain|united kingdom|england)\b/, "United Kingdom"],
    [/\b(india|in)\b/, "India"],
    [/\b(eu|europe)\b/, "Germany"],
    [/\b(canada|ca)\b/, "Canada"],
    [/\b(australia|au)\b/, "Australia"],
    [/\b(singapore|sg)\b/, "Singapore"],
    [/\b(uae|emirates|ae|dubai)\b/, "United Arab Emirates"],
  ];
  for (const [re, country] of list) {
    if (re.test(text) && !found.includes(country)) found.push(country);
  }
  return found;
}
