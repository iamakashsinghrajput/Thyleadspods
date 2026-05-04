import { searchAccounts, type ApolloAccountResult } from "./apollo";
import { llm, isLlmLive } from "./llm";
import { buildApolloFiltersFromForm } from "./icp";

export type AgentKind = "research" | "demand" | "icp" | "synthesis";

export interface AgentInput {
  clientName: string;
  icp: string;
  jobTitles: string[];
  competitors: string[];
  answers: Record<string, unknown>;
}

export interface AgentResult {
  kind: AgentKind;
  status: "complete" | "failed";
  output: string;        // markdown body
  data?: unknown;        // structured payload (e.g. apollo rows)
  model: string;         // e.g. "claude-sonnet-4-6" or "mock"
  isLive: boolean;
  inputTokens: number;
  outputTokens: number;
  startedAt: string;
  completedAt: string;
  error?: string;
}

export function isAnthropicLive(): boolean {
  return isLlmLive();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry: runs the four agents and returns the four results.
// ─────────────────────────────────────────────────────────────────────────────
export async function runAllAgents(input: AgentInput): Promise<AgentResult[]> {
  // Agents 1-3 are independent — fan out in parallel.
  const [research, demand, icp] = await Promise.all([
    runResearchAgent(input),
    runDemandAgent(input),
    runIcpAgent(input),
  ]);

  // Agent 4 needs the outputs of 1-3.
  const synthesis = await runSynthesisAgent(input, { research, demand, icp });

  return [research, demand, icp, synthesis];
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 1 — General client research
// ─────────────────────────────────────────────────────────────────────────────
async function runResearchAgent(input: AgentInput): Promise<AgentResult> {
  const startedAt = new Date().toISOString();
  const system = `You are a B2B research analyst. Produce a concise, factual brief about a company we're about to run cold-outbound for. Output well-structured markdown with sections: Overview, Product, Funding & Stage, Recent News, Pain Points (the kind of pain the client likely solves for buyers), Notable Customers (if known). Keep it under 400 words. If you don't know something, say so — do not fabricate.`;
  const user = renderUser({
    title: "Client research brief",
    payload: {
      client: input.clientName,
      icp_description: input.icp,
      target_titles: input.jobTitles,
      competitors: input.competitors,
      raw_form_answers: input.answers,
    },
  });
  return callOrMock("research", { system, user, startedAt }, () => mockResearch(input));
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 2 — Product-demand research (via MCP server)
// ─────────────────────────────────────────────────────────────────────────────
async function runDemandAgent(input: AgentInput): Promise<AgentResult> {
  const startedAt = new Date().toISOString();
  const system = `You are a market-demand analyst. Use the connected MCP tools to look up signals of demand for the client's product in the buyer segments described. Return markdown with: Demand Signals (job posts, hiring spikes, recent funding in the buyer segment, conference activity), Buying Triggers, Seasonality, and a Demand Score 1-10 with one sentence justifying the score.`;
  const user = renderUser({
    title: "Product-demand research",
    payload: {
      client: input.clientName,
      icp: input.icp,
      target_titles: input.jobTitles,
      competitors: input.competitors,
    },
  });

  // When you wire a real MCP server, pass mcp_servers in the request body.
  // Anthropic's MCP connector expects: { mcp_servers: [{ type: "url", url, name, authorization_token? }] }
  // Until then, mock returns realistic demand signals.
  const mcpServers = parseMcpServers();
  return callOrMock("demand", { system, user, startedAt, mcpServers }, () => mockDemand(input));
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 3 — ICP discovery (Apollo + Claude reasoning)
// ─────────────────────────────────────────────────────────────────────────────
async function runIcpAgent(input: AgentInput): Promise<AgentResult> {
  const startedAt = new Date().toISOString();

  // Step 1 — pull a candidate set from Apollo (already env-gated for live/mock).
  // Use the LLM-backed ICP extractor to translate the form into structured Apollo filters.
  let apolloRows: ApolloAccountResult[] = [];
  let resolvedFilter: Awaited<ReturnType<typeof buildApolloFiltersFromForm>> | null = null;
  try {
    resolvedFilter = await buildApolloFiltersFromForm({
      companyName: input.clientName,
      companyOneLine: typeof input.answers.companyOneLine === "string" ? input.answers.companyOneLine : "",
      icp: input.icp,
      jobTitles: input.jobTitles,
      competitors: input.competitors,
      existingCustomers: Array.isArray(input.answers.existingCustomers) ? (input.answers.existingCustomers as string[]) : [],
      targetGeos: Array.isArray(input.answers.targetGeos) ? (input.answers.targetGeos as string[]) : [],
      volumeForecast: typeof input.answers.volumeForecast === "number" ? input.answers.volumeForecast : 0,
    }, 25);
    apolloRows = await searchAccounts(resolvedFilter);
  } catch {
    apolloRows = [];
  }

  // Step 2 — Claude reasons over the candidates and the form answers to
  // describe the cleaned ICP and rank the candidates.
  const system = `You are an ICP analyst. Given a list of candidate accounts from Apollo and a client's onboarding form, produce: 1) a refined ICP definition (firmographics, technographics, buyer pain), 2) a ranked Top-10 from the candidates with one-line rationale each, 3) Disqualifiers — kinds of accounts to exclude. Markdown only.`;
  const user = renderUser({
    title: "ICP discovery",
    payload: {
      client: input.clientName,
      stated_icp: input.icp,
      target_titles: input.jobTitles,
      competitors: input.competitors,
      candidate_accounts: apolloRows.map((a) => ({
        name: a.companyName, domain: a.domain, industry: a.industry, employees: a.employeeCount,
      })),
    },
  });

  const result = await callOrMock("icp", { system, user, startedAt }, () => mockIcp(input, apolloRows));
  result.data = {
    apolloRows,
    isApolloLive: apolloRows.some((r) => r.source === "apollo"),
    resolvedFilter,
  };
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent 4 — Synthesis + template generation + data verification
// ─────────────────────────────────────────────────────────────────────────────
async function runSynthesisAgent(
  input: AgentInput,
  ctx: { research: AgentResult; demand: AgentResult; icp: AgentResult },
): Promise<AgentResult> {
  const startedAt = new Date().toISOString();
  const system = `You are an outbound strategist. You will receive three upstream agent reports (general research, market demand, refined ICP). Use them to produce: 1) a 3-step outbound sequence — subject + body for each email, written in the client's voice not ours, 2) two LinkedIn touch templates, 3) a Verification Notes section listing any factual claims the upstream agents made that should be double-checked before sending, and which of the candidate accounts have weak signals. Markdown only. Templates should reference concrete pain points, not generic copy.`;
  const user = renderUser({
    title: "Synthesis + templates + verification",
    payload: {
      client: input.clientName,
      stated_icp: input.icp,
      target_titles: input.jobTitles,
      competitors: input.competitors,
      upstream: {
        general_research: ctx.research.output,
        product_demand: ctx.demand.output,
        refined_icp: ctx.icp.output,
      },
    },
  });
  return callOrMock("synthesis", { system, user, startedAt }, () => mockSynthesis(input));
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider-agnostic call wrapper — falls back to mock when no key
// ─────────────────────────────────────────────────────────────────────────────
interface CallOpts {
  system: string;
  user: string;
  startedAt: string;
  mcpServers?: McpServer[];
}

interface McpServer {
  type: "url";
  url: string;
  name: string;
  authorization_token?: string;
}

async function callOrMock(
  kind: AgentKind,
  opts: CallOpts,
  mockFactory: () => string,
): Promise<AgentResult> {
  const result = await llm({
    system: opts.system,
    user: opts.user,
    maxTokens: 1500,
    mockOutput: mockFactory(),
    mcpServers: opts.mcpServers,
  });

  return {
    kind,
    status: result.error ? "failed" : "complete",
    output: result.text,
    model: result.model,
    isLive: result.isLive,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    startedAt: opts.startedAt,
    completedAt: new Date().toISOString(),
    error: result.error,
  };
}

function renderUser(args: { title: string; payload: unknown }): string {
  return `# ${args.title}\n\nInputs:\n\n\`\`\`json\n${JSON.stringify(args.payload, null, 2)}\n\`\`\``;
}

// MCP servers are read from env: ONBOARDING_MCP_URL (+ optional ONBOARDING_MCP_TOKEN, ONBOARDING_MCP_NAME).
// Empty array means "no MCP" — mock path is used instead.
function parseMcpServers(): McpServer[] {
  const url = process.env.ONBOARDING_MCP_URL;
  if (!url) return [];
  return [{
    type: "url",
    url,
    name: process.env.ONBOARDING_MCP_NAME || "onboarding-demand",
    ...(process.env.ONBOARDING_MCP_TOKEN ? { authorization_token: process.env.ONBOARDING_MCP_TOKEN } : {}),
  }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock outputs — realistic enough that the UI feels real during dev.
// ─────────────────────────────────────────────────────────────────────────────

function mockResearch(input: AgentInput): string {
  return `## ${input.clientName} — Research Brief *(mock)*

**Overview** — ${input.clientName} is a B2B company targeting "${input.icp || "unspecified ICP"}". This is a placeholder summary because \`ANTHROPIC_API_KEY\` is not set; once configured, this section will be generated by Claude using public web data.

**Product** — Likely category inferred from form: ${input.icp || "n/a"}. Specific positioning, pricing, and feature set will be researched live.

**Funding & Stage** — Unknown without live research.

**Recent News** — Unknown without live research.

**Pain Points** — Buyers in this segment typically deal with: process drag, fragmented data, and slow time-to-value. (Mock — replace with live agent output.)

**Notable Customers** — TBD live.

> Mode: mock · agent: research · model: mock`;
}

function mockDemand(input: AgentInput): string {
  return `## Product-Demand Signals *(mock)*

**Demand Signals**
- Hiring activity: trending up in segments matching the target titles (${input.jobTitles.slice(0, 3).join(", ") || "n/a"}).
- Conference activity: relevant industry events scheduled in the next 90 days.
- Funding: several recent Series-B and Series-C rounds in the segment.

**Buying Triggers**
- New head-of-function hires (esp. ${input.jobTitles[0] || "VP-level"}).
- Public mentions of ${input.competitors[0] || "a competitor"} adoption — switch-cost windows.
- Compliance / regulation changes in the buyer's industry.

**Seasonality**
- Q1 budget unlocks; mid-Q4 freezes.

**Demand Score: 7/10** — solid demand, with strong tailwinds from hiring + recent funding.

> Mode: mock · agent: demand · model: mock · MCP: not configured`;
}

function mockIcp(input: AgentInput, apolloRows: ApolloAccountResult[]): string {
  const top = apolloRows.slice(0, 5);
  const ranked = top.length === 0
    ? "_(No Apollo candidates available — set APOLLO_API_KEY to enable live discovery.)_"
    : top.map((r, i) => `${i + 1}. **${r.companyName}** (${r.industry || "—"}, ~${r.employeeCount} emp) — strong fit on industry + size.`).join("\n");

  return `## Refined ICP *(mock)*

**Firmographics**
- Industry: ${input.icp || "unspecified"}
- Employee count: 100–2,000 (mid-market)
- Geo: North America + EU

**Technographics**
- Stack signals to look for: ${input.competitors.length > 0 ? input.competitors.join(", ") : "modern SaaS, cloud-native"}.

**Buyer Pain**
- Slow workflows tied to ${input.icp || "the segment"}; data fragmentation; pressure on cost-per-conversion.

**Top Candidates from Apollo**
${ranked}

**Disqualifiers**
- < 50 employees (likely under-resourced).
- > 5,000 employees (procurement cycles too long for cold outbound).
- Direct competitors of ${input.clientName}.

> Mode: mock · agent: icp · model: mock · apollo rows: ${apolloRows.length}`;
}

function mockSynthesis(input: AgentInput): string {
  const title = input.jobTitles[0] || "Operations Lead";
  return `## Outbound Sequence — ${input.clientName} *(mock)*

### Step 1 · Email · Day 0
**Subject:** Quick one for ${title}s at {{company}}

Hi {{first_name}},

Saw {{company}} is scaling its ${title.toLowerCase()} function — congrats on the recent growth. Most teams in your segment hit a wall around ${input.icp || "process scale"} once they cross 200 reps.

We help ${input.clientName.toLowerCase()}-style teams cut that loop. Worth 15 min to compare notes?

— {{sender_first_name}}

### Step 2 · Email · Day 4
**Subject:** Re: Quick one for ${title}s at {{company}}

Bumping this up. Two of your peers (${input.competitors[0] || "industry peer"}-style co's) saw a 2x lift on the same workflow. Open to a short call?

### Step 3 · Email · Day 10
**Subject:** Last note from me

Closing the loop, {{first_name}}. If now's not the time, no worries. Worth keeping a thread open if priorities shift in Q4?

### LinkedIn · Touch 1
{{first_name}}, working with a few teams scaling ${title.toLowerCase()} ops — figured you'd find ${input.clientName}'s approach interesting. Mind if I send you a 90-sec teardown?

### LinkedIn · Touch 2
Following up on my note — happy to drop the case study even if there's no fit, take what's useful.

---

### Verification Notes
- Demand Score (7/10) is a heuristic; verify with current LinkedIn job-post counts before sending.
- Apollo candidates flagged in Agent 3 should be cross-checked against an existing-customers list.
- Any claims about competitor adoption ("${input.competitors[0] || "competitor"} switching") are mock — confirm with public sources before they reach prospects.

> Mode: mock · agent: synthesis · model: mock`;
}
