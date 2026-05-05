import OutboundPilot from "@/lib/models/outbound/pilot";
import OutboundAccount from "@/lib/models/outbound/account";
import OutboundLead from "@/lib/models/outbound/lead";
import { PHASE_DEFS, PHASE_KEYS, makePersonKey, type PhaseKey, type PhaseState, type EnrichedAccount, type LeadEmail, type ScoredAccount, type Stakeholder, type LeadResearch } from "./types";
import { ingestAgent } from "./agents/phase1-ingest";
import { filterAgent } from "./agents/phase2-filter";
import { subsetAgent } from "./agents/phase3-subset";
import { enrichAgent } from "./agents/phase4-enrich";
import { scoreAgent, VWO_INDUSTRY_WEIGHTS_V2, DEFAULT_HIGH_FIT_KEYWORDS_V2 } from "./agents/phase5-score";
import { stakeholderAgent } from "./agents/phase6-stakeholder";
import { emailMatchAgent } from "./agents/phase7-email-match";
import { researchAgent } from "./agents/phase8-research";
import { promptBuildAgent } from "./agents/phase9-prompt-build";
import { validateAgent } from "./agents/phase10-validate";
import { exportClaudePasteAgent } from "./agents/phase11-export";

interface PilotDoc {
  _id: { toString(): string };
  pilotName: string;
  status: string;
  config: Record<string, unknown>;
  inputs: Record<string, unknown>;
  phases: PhaseState[];
  totalApolloCredits: number;
  totalLlmTokensIn: number;
  totalLlmTokensOut: number;
  finalCsv: string;
  skillContent?: string;
  clientBrief?: {
    sellerProduct?: string;
    sellerOneLineValue?: string;
    sellerCapabilities?: string[];
    sellerUsps?: string[];
    targetSegments?: string[];
    targetPersonas?: string[];
    commonPainsSolved?: string[];
    caseStudyWins?: string[];
    antiIcp?: string[];
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_SOCIAL_PROOF: Record<string, string[]> = {
  retail: ["BigBasket", "Yuppiechef", "eBay"],
  apparel: ["Andaaz Fashion", "Attrangi", "Utsav Fashion"],
  ecommerce: ["BigBasket", "Yuppiechef", "Andaaz Fashion"],
  fintech: ["PayU", "HDFC Bank"],
  edtech: ["Online Manipal", "UNext"],
  saas: ["POSist", "PayScale"],
  wellness: ["Amway"],
  marketplace: ["BigBasket", "eBay"],
  default: ["Indian D2C brands at your stage"],
};

function toEnrichedAccount(doc: Record<string, unknown>): EnrichedAccount {
  const num = (v: unknown) => typeof v === "number" ? v : Number(v) || 0;
  const str = (v: unknown) => typeof v === "string" ? v : "";
  const arr = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : [];
  return {
    domain: str(doc.domain),
    name: str(doc.name),
    industry: str(doc.industry),
    secondaryIndustries: arr(doc.secondaryIndustries),
    estimatedNumEmployees: num(doc.estimatedNumEmployees),
    organizationRevenuePrinted: str(doc.organizationRevenuePrinted),
    foundedYear: num(doc.foundedYear),
    city: str(doc.city),
    state: str(doc.state),
    country: str(doc.country),
    ownedByOrganization: str(doc.ownedByOrganization),
    shortDescription: str(doc.shortDescription),
    keywords: arr(doc.keywords),
    dhMarketing: num(doc.dhMarketing),
    dhEngineering: num(doc.dhEngineering),
    dhProductManagement: num(doc.dhProductManagement),
    dhSales: num(doc.dhSales),
    headcount6mGrowth: num(doc.headcount6mGrowth),
    headcount12mGrowth: num(doc.headcount12mGrowth),
    alexaRanking: num(doc.alexaRanking),
    linkedinUrl: str(doc.linkedinUrl),
    publiclyTradedSymbol: str(doc.publiclyTradedSymbol),
  };
}

export function emptyPhaseState(key: PhaseKey): PhaseState {
  return {
    key, status: "pending", startedAt: null, completedAt: null,
    durationMs: 0, inputCount: 0, outputCount: 0, metrics: {}, log: [],
    error: "", apolloCreditsUsed: 0, llmTokensIn: 0, llmTokensOut: 0,
  };
}

export function ensurePhases(phases: PhaseState[] = []): PhaseState[] {
  const map = new Map(phases.map((p) => [p.key, p]));
  return PHASE_KEYS.map((k) => map.get(k) || emptyPhaseState(k));
}

async function persistPhase(pilotId: string, state: PhaseState) {
  const doc = (await OutboundPilot.findById(pilotId).lean()) as PilotDoc | null;
  if (!doc) return;
  const phases = ensurePhases(doc.phases);
  const idx = phases.findIndex((p) => p.key === state.key);
  if (idx >= 0) phases[idx] = state;
  await OutboundPilot.findByIdAndUpdate(pilotId, {
    phases,
    totalApolloCredits: phases.reduce((a, b) => a + (b.apolloCreditsUsed || 0), 0),
    totalLlmTokensIn: phases.reduce((a, b) => a + (b.llmTokensIn || 0), 0),
    totalLlmTokensOut: phases.reduce((a, b) => a + (b.llmTokensOut || 0), 0),
    updatedAt: new Date(),
  });
}

async function runPhase<T>(
  pilotId: string,
  key: PhaseKey,
  fn: (ctx: { signal: AbortSignal }) => Promise<{ state: Partial<PhaseState>; result: T }> | { state: Partial<PhaseState>; result: T },
): Promise<T> {
  if (await isCancelRequested(pilotId)) {
    const now = new Date();
    await persistPhase(pilotId, {
      ...emptyPhaseState(key),
      status: "failed",
      error: "Stopped by user",
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
    });
    throw new PipelineCancelled();
  }
  const startedAt = new Date();
  const startState: PhaseState = {
    ...emptyPhaseState(key),
    status: "running",
    startedAt: startedAt.toISOString(),
  };
  await persistPhase(pilotId, startState);

  const abortController = new AbortController();
  const watcher = setInterval(async () => {
    try {
      if (await isCancelRequested(pilotId)) {
        abortController.abort(new PipelineCancelled());
      }
    } catch {}
  }, 1500);

  try {
    const out = await fn({ signal: abortController.signal });
    clearInterval(watcher);
    if (abortController.signal.aborted) throw new PipelineCancelled();
    const completedAt = new Date();
    const merged: PhaseState = {
      ...startState,
      ...out.state,
      key,
      status: "complete",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };
    await persistPhase(pilotId, merged);
    return out.result;
  } catch (err) {
    clearInterval(watcher);
    const completedAt = new Date();
    const isCancel = err instanceof PipelineCancelled || abortController.signal.aborted;
    const failed: PhaseState = {
      ...startState,
      status: "failed",
      error: isCancel ? "Stopped by user" : (err instanceof Error ? err.message : "unknown"),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };
    await persistPhase(pilotId, failed);
    throw isCancel ? new PipelineCancelled() : err;
  }
}

function phaseIndex(k: PhaseKey): number {
  return PHASE_KEYS.indexOf(k);
}

async function loadScoredAccountsForPilot(pilotId: string): Promise<{ all: ScoredAccount[]; top: ScoredAccount[] }> {
  const docs = (await OutboundAccount.find({ pilotId, enriched: true }).sort({ score: -1 }).lean()) as unknown as Array<Record<string, unknown>>;
  const num = (v: unknown) => typeof v === "number" ? v : Number(v) || 0;
  const str = (v: unknown) => typeof v === "string" ? v : "";
  const all: ScoredAccount[] = docs.map((d) => {
    const base = toEnrichedAccount(d);
    const segment = (str(d.segment) || "excluded") as ScoredAccount["segment"];
    return {
      ...base,
      score: num(d.score),
      segment,
      scoreBreakdown: (d.scoreBreakdown && typeof d.scoreBreakdown === "object") ? (d.scoreBreakdown as Record<string, number>) : {},
    };
  });
  const ranked = docs
    .filter((d) => num(d.rank) > 0)
    .sort((a, b) => num(a.rank) - num(b.rank))
    .map((d) => {
      const base = toEnrichedAccount(d);
      const segment = (str(d.segment) || "excluded") as ScoredAccount["segment"];
      return {
        ...base,
        score: num(d.score),
        segment,
        scoreBreakdown: (d.scoreBreakdown && typeof d.scoreBreakdown === "object") ? (d.scoreBreakdown as Record<string, number>) : {},
      };
    });
  return { all, top: ranked };
}

interface LoadedLead {
  account: ScoredAccount;
  stakeholder: Stakeholder | null;
  email: LeadEmail | null;
  research: LeadResearch | null;
  draft: { subject1: string; body1: string; subject2: string; body2: string; subject3: string; body3: string } | null;
  fullName: string;
  personKey: string;
}

async function loadLeadsForPilot(pilotId: string, top: ScoredAccount[]): Promise<LoadedLead[]> {
  const accountByDomain = new Map(top.map((t) => [t.domain, t]));
  const leadDocs = (await OutboundLead.find({ pilotId }).sort({ rank: 1 }).lean()) as unknown as Array<Record<string, unknown>>;
  const num = (v: unknown) => typeof v === "number" ? v : Number(v) || 0;
  const str = (v: unknown) => typeof v === "string" ? v : "";
  const out: LoadedLead[] = [];
  for (const d of leadDocs) {
    const domain = str(d.accountDomain).toLowerCase();
    const account = accountByDomain.get(domain);
    if (!account) continue;
    const fullName = str(d.fullName) || `${str(d.firstName)} ${str(d.lastName)}`.trim();
    const personKey = str(d.personKey) || makePersonKey({ linkedinUrl: str(d.contactLinkedinUrl), fullName, firstName: str(d.firstName), lastName: str(d.lastName) });
    const stakeholder: Stakeholder | null = fullName ? {
      firstName: str(d.firstName),
      lastName: str(d.lastName),
      fullName,
      title: str(d.contactTitle),
      linkedinUrl: str(d.contactLinkedinUrl),
      seniority: str(d.contactSeniority),
      pickedReason: str(d.pickedReason),
      personKey,
    } : null;
    const emailStr = str(d.email);
    const emailStatus = str(d.emailStatus);
    const email: LeadEmail | null = emailStr || emailStatus ? {
      email: emailStr,
      emailStatus: (["verified", "likely_to_engage", "unavailable", "missing"].includes(emailStatus)
        ? emailStatus
        : "unavailable") as LeadEmail["emailStatus"],
    } : null;
    const obs = str(d.observationAngle);
    const research: LeadResearch | null = obs ? {
      observationAngle: obs,
      secondaryObservation: str(d.secondaryObservation),
      signalForBody3: str(d.signalForBody3),
      theirCustomers: str(d.theirCustomers),
      whatTheySell: str(d.whatTheySell),
      theirStage: str(d.theirStage),
      topPain: str(d.topPain),
      valueAngle: str(d.valueAngle),
      socialProofMatch: Array.isArray(d.socialProofMatch) ? d.socialProofMatch.map(String) : [],
      subjectTopic: str(d.subjectTopic),
    } : null;
    const draft = str(d.body1) ? {
      subject1: str(d.subject1), body1: str(d.body1),
      subject2: str(d.subject2), body2: str(d.body2),
      subject3: str(d.subject3), body3: str(d.body3),
    } : null;
    void num;
    out.push({ account, stakeholder, email, research, draft, fullName, personKey });
  }
  return out;
}

async function isCancelRequested(pilotId: string): Promise<boolean> {
  const d = await OutboundPilot.findById(pilotId).select("cancelRequested").lean<{ cancelRequested?: boolean }>();
  return !!(d && d.cancelRequested);
}

class PipelineCancelled extends Error {
  constructor() { super("Pipeline cancelled by user"); this.name = "PipelineCancelled"; }
}

export async function runPipeline(pilotId: string, opts: { stopAfter?: PhaseKey; startFrom?: PhaseKey; testLimit?: number } = {}): Promise<void> {
  await OutboundPilot.findByIdAndUpdate(pilotId, {
    cancelRequested: false,
    cancelRequestedAt: null,
    cancelRequestedBy: "",
    updatedAt: new Date(),
  });

  const doc = (await OutboundPilot.findById(pilotId).lean()) as PilotDoc | null;
  if (!doc) throw new Error("pilot not found");

  const startIdx = opts.startFrom ? phaseIndex(opts.startFrom) : 0;
  if (startIdx < 0) throw new Error(`unknown startFrom phase: ${opts.startFrom}`);

  if (startIdx > 0) {
    const phases = ensurePhases(doc.phases);
    const updated = phases.map((p) => {
      const i = phaseIndex(p.key);
      if (i < startIdx && (p.status === "complete" || p.status === "running" || p.status === "failed")) return p;
      if (i < startIdx) {
        return p;
      }
      return { ...emptyPhaseState(p.key) };
    });
    await OutboundPilot.findByIdAndUpdate(pilotId, { phases: updated, updatedAt: new Date() });
  }

  await OutboundPilot.findByIdAndUpdate(pilotId, { status: "running", updatedAt: new Date() });

  const config = doc.config as {
    geoFocus?: string;
    priorityTlds?: string[];
    enrichSubsetCap?: number;
    topNAfterScore?: number;
    maxPerIndustry?: number;
    apolloCreditsBudget?: number;
    bulkEnrichTopN?: number;
    useFreeSearchFirst?: boolean;
    useAi?: boolean;
    industryWeights?: Record<string, number>;
    highFitKeywords?: string[];
    championTitles?: string[];
    socialProofLibrary?: Record<string, string[]>;
    sellerName?: string;
  };
  const inputs = doc.inputs as {
    targets?: string[];
    dnc?: string[];
    activeCustomers?: string[];
    pastMeetings?: string[];
    sellerDomains?: string[];
    pastMeetingTokens?: string[];
  };

  const dataPilotId = opts.testLimit ? `${pilotId}__test` : pilotId;

  let stopAfterReached = false;
  function shouldStop(after: PhaseKey): boolean {
    if (!opts.stopAfter) return false;
    if (after === opts.stopAfter) stopAfterReached = true;
    return stopAfterReached;
  }

  const ingestStub = {
    targets: inputs.targets || [],
    dnc: inputs.dnc || [],
    activeCustomers: inputs.activeCustomers || [],
    pastMeetings: inputs.pastMeetings || [],
    sellerDomains: inputs.sellerDomains || [],
    pastMeetingTokens: inputs.pastMeetingTokens || [],
  };
  const ingest = startIdx > phaseIndex("ingest") ? ingestStub : await runPhase(pilotId, "ingest", () => {
    const r = ingestAgent({
      rawTargets: (inputs.targets || []).join("\n"),
      rawDnc: (inputs.dnc || []).join("\n"),
      rawActiveCustomers: (inputs.activeCustomers || []).join("\n"),
      rawPastMeetings: (inputs.pastMeetings || []).join("\n"),
      rawSellerDomains: (inputs.sellerDomains || []).join("\n"),
    });
    return { state: r.state, result: r.output };
  });
  if (shouldStop("ingest")) { await OutboundPilot.findByIdAndUpdate(pilotId, { status: "paused", updatedAt: new Date() }); return; }

  const filter = startIdx > phaseIndex("filter")
    ? { eligible: [] as string[], excluded: [] as { domain: string; reason: string }[] }
    : await runPhase(pilotId, "filter", () => {
        const r = filterAgent({
          targets: ingest.targets,
          dnc: ingest.dnc,
          activeCustomers: ingest.activeCustomers,
          pastMeetingTokens: ingest.pastMeetingTokens,
          sellerDomains: ingest.sellerDomains,
        });
        return { state: r.state, result: r.output };
      });
  if (shouldStop("filter")) { await OutboundPilot.findByIdAndUpdate(pilotId, { status: "paused", updatedAt: new Date() }); return; }

  const subset = startIdx > phaseIndex("subset")
    ? { subset: [] as string[], batches: [] as string[][], priorityCount: 0, comD2cCount: 0, otherCount: 0 }
    : await runPhase(pilotId, "subset", () => {
        const subsetCap = opts.testLimit ? Math.max(opts.testLimit * 3, 30) : (config.enrichSubsetCap || 1500);
        const r = subsetAgent({
          eligible: filter.eligible,
          priorityTlds: config.priorityTlds || ["in", "co.in", "ac.in", "org.in", "net.in", "bank.in"],
          enrichSubsetCap: subsetCap,
        });
        return { state: r.state, result: r.output };
      });
  if (shouldStop("subset")) { await OutboundPilot.findByIdAndUpdate(pilotId, { status: "paused", updatedAt: new Date() }); return; }

  const enrich = startIdx > phaseIndex("enrich")
    ? await (async () => {
        const docs = (await OutboundAccount.find({ pilotId: dataPilotId }).lean()) as unknown as Array<Record<string, unknown>>;
        return { enriched: docs.map(toEnrichedAccount), unmatched: [] as string[], creditsUsed: 0, cacheHits: 0, searchHits: 0, fullEnrichHits: 0 };
      })()
    : await runPhase(pilotId, "enrich", async ({ signal }) => {
        const existingDocs = (await OutboundAccount.find({ pilotId: dataPilotId }).lean()) as unknown as Array<Record<string, unknown>>;
        const existingMap = new Map<string, ReturnType<typeof toEnrichedAccount>>();
        for (const doc of existingDocs) {
          const d = String(doc.domain || "").toLowerCase().trim();
          if (d) existingMap.set(d, toEnrichedAccount(doc));
        }

        async function persistBatch(rows: Array<ReturnType<typeof toEnrichedAccount>>, source: "cache" | "apollo-search" | "apollo-enrich") {
          if (source === "cache" || rows.length === 0) return;
          const fullyEnriched = source === "apollo-enrich";
          for (const e of rows) {
            const domain = (e.domain || "").toLowerCase().trim();
            if (!domain) continue;
            await OutboundAccount.updateOne(
              { pilotId: dataPilotId, domain },
              { $set: { ...e, domain, pilotId: dataPilotId, enriched: fullyEnriched } },
              { upsert: true },
            );
          }
        }

        const r = await enrichAgent({
          batches: subset.batches,
          apolloCreditsBudget: config.apolloCreditsBudget || 1500,
          existingAccounts: existingMap,
          onBatch: persistBatch,
          shouldCancel: () => isCancelRequested(pilotId),
          signal,
          bulkEnrichTopN: config.bulkEnrichTopN,
          useFreeSearchFirst: config.useFreeSearchFirst !== false,
        });
        return { state: r.state, result: r.output };
      });
  if (shouldStop("enrich")) { await OutboundPilot.findByIdAndUpdate(pilotId, { status: "paused", updatedAt: new Date() }); return; }

  const score = startIdx > phaseIndex("score")
    ? await loadScoredAccountsForPilot(dataPilotId)
    : await runPhase(pilotId, "score", async () => {
        const cfg = config as Record<string, unknown>;
        const projectData = {
          activeClientDomains: new Set<string>(((inputs.activeCustomers as string[] | undefined) || []).map((d) => d.toLowerCase())),
          pastMeetingTokens: new Set<string>(((inputs.pastMeetingTokens as string[] | undefined) || [])),
          dncDomains: new Set<string>(((inputs.dnc as string[] | undefined) || []).map((d) => d.toLowerCase())),
          sellerDomains: new Set<string>(((inputs.sellerDomains as string[] | undefined) || []).map((d) => d.toLowerCase())),
          pastMeetingSubsegmentCounts: {} as Record<string, number>,
          activeCustomerProfiles: [] as Array<{ industry: string; employees: number }>,
        };

        const scoringConfig = {
          geographyHardFilter: (cfg.geographyHardFilter as string[] | undefined) || [config.geoFocus || "India"],
          industryWeights: (cfg.industryWeights as Record<string, number> | undefined) && Object.keys(cfg.industryWeights as Record<string, number>).length > 0
            ? (cfg.industryWeights as Record<string, number>)
            : VWO_INDUSTRY_WEIGHTS_V2,
          antiIcpIndustries: (cfg.antiIcpIndustries as string[] | undefined) || ["government administration", "defense & space", "gambling & casinos", "tobacco", "firearms", "religious institutions", "libraries"],
          highFitKeywords: (config.highFitKeywords && config.highFitKeywords.length > 0) ? config.highFitKeywords : DEFAULT_HIGH_FIT_KEYWORDS_V2,
          directCompetitors: (cfg.directCompetitors as string[] | undefined) || [],
          partnerAgencies: (cfg.partnerAgencies as string[] | undefined) || [],
          competitorCustomerDb: (cfg.competitorCustomerDb as Record<string, string[]> | undefined) || {},
          provenSubsegments: (cfg.provenSubsegments as Record<string, number> | undefined) || {},
          employeeSweetSpotMin: (cfg.employeeSweetSpotMin as number | undefined) ?? 50,
          employeeSweetSpotMax: (cfg.employeeSweetSpotMax as number | undefined) ?? 1500,
          alexaHardFilterMax: (cfg.alexaHardFilterMax as number | undefined) ?? 2_000_000,
        };

        const r = scoreAgent({
          enriched: enrich.enriched,
          config: scoringConfig,
          projectData,
          topN: opts.testLimit || Number.MAX_SAFE_INTEGER,
          maxPerIndustry: opts.testLimit || Number.MAX_SAFE_INTEGER,
        });

        const rankByDomain = new Map<string, number>();
        for (let i = 0; i < r.output.top.length; i++) {
          rankByDomain.set(r.output.top[i].domain, i + 1);
        }

        const ops = r.output.all.map((a) => ({
          updateOne: {
            filter: { pilotId: dataPilotId, domain: a.domain },
            update: {
              $set: {
                score: a.score,
                segment: a.segment,
                scoreBreakdown: a.scoreBreakdown,
                rank: rankByDomain.get(a.domain) || 0,
              },
            },
          },
        }));

        const CHUNK = 1000;
        const totalChunks = Math.ceil(ops.length / CHUNK);
        const persistStart = Date.now();
        for (let i = 0; i < ops.length; i += CHUNK) {
          const chunk = ops.slice(i, i + CHUNK);
          await OutboundAccount.bulkWrite(chunk, { ordered: false });
          const chunkIdx = Math.floor(i / CHUNK) + 1;
          r.state.log.push(`Persisted scores: chunk ${chunkIdx}/${totalChunks} (${Math.min(i + CHUNK, ops.length)}/${ops.length} rows)…`);
          await persistPhase(pilotId, {
            ...emptyPhaseState("score"),
            status: "running",
            startedAt: new Date(persistStart).toISOString(),
            log: r.state.log,
            metrics: { ...r.state.metrics, persistedChunks: chunkIdx, persistedRows: Math.min(i + CHUNK, ops.length) },
            inputCount: r.state.inputCount,
            outputCount: r.state.outputCount,
          });
        }

        return { state: r.state, result: r.output };
      });
  if (shouldStop("score")) { await OutboundPilot.findByIdAndUpdate(pilotId, { status: "paused", updatedAt: new Date() }); return; }

  const stakeholder = startIdx > phaseIndex("stakeholder")
    ? await (async () => {
        const loaded = await loadLeadsForPilot(dataPilotId, score.top);
        return {
          rows: loaded.map((l) => ({ account: l.account, stakeholder: l.stakeholder })),
          found: loaded.filter((l) => l.stakeholder).length,
          missed: loaded.filter((l) => !l.stakeholder).length,
        };
      })()
    : await runPhase(pilotId, "stakeholder", async ({ signal }) => {
        const newDomainSet = new Set(score.top.map((t) => (t.domain || "").toLowerCase().trim()).filter(Boolean));
        await OutboundLead.deleteMany({ pilotId: dataPilotId, accountDomain: { $nin: Array.from(newDomainSet) } });
        await OutboundLead.deleteMany({ pilotId: dataPilotId, accountDomain: { $in: Array.from(newDomainSet) } });

        async function persistAccount(row: { account: ScoredAccount; stakeholder: Stakeholder | null }, i: number) {
          const a = row.account;
          const s = row.stakeholder;
          const domain = (a.domain || "").toLowerCase().trim();
          if (!domain) return;
          const personKey = s?.personKey || "";
          if (!personKey) return;
          await OutboundLead.updateOne({ pilotId: dataPilotId, accountDomain: domain, personKey }, {
            $set: {
              pilotId: dataPilotId, accountDomain: domain, personKey,
              companyShort: a.name, companyFull: a.name,
              industry: a.industry, employees: a.estimatedNumEmployees,
              country: a.country, score: a.score, segment: a.segment,
              rank: i + 1,
              firstName: s?.firstName || "", lastName: s?.lastName || "",
              fullName: s?.fullName || "", contactTitle: s?.title || "",
              contactLinkedinUrl: s?.linkedinUrl || "",
              contactSeniority: s?.seniority || "",
              pickedReason: s?.pickedReason || "",
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          }, { upsert: true });
        }

        const r = await stakeholderAgent({
          topAccounts: score.top,
          championTitles: config.championTitles || [],
          shouldCancel: () => isCancelRequested(pilotId),
          signal,
          onAccount: persistAccount,
        });
        return { state: r.state, result: r.output };
      });
  if (shouldStop("stakeholder")) { await OutboundPilot.findByIdAndUpdate(pilotId, { status: "paused", updatedAt: new Date() }); return; }

  const emailMatch = startIdx > phaseIndex("email_match")
    ? await (async () => {
        const loaded = await loadLeadsForPilot(dataPilotId, score.top);
        const results: { domain: string; personKey: string; email: LeadEmail }[] = [];
        let verifiedCount = 0, likelyCount = 0, unavailableCount = 0;
        for (const l of loaded) {
          const e: LeadEmail = l.email || { email: "", emailStatus: "unavailable" };
          results.push({ domain: l.account.domain, personKey: l.personKey, email: e });
          if (e.emailStatus === "verified") verifiedCount++;
          else if (e.emailStatus === "likely_to_engage") likelyCount++;
          else unavailableCount++;
        }
        return { results, creditsUsed: 0, verifiedCount, likelyCount, unavailableCount, cacheHits: results.length };
      })()
    : await runPhase(pilotId, "email_match", async ({ signal }) => {
    const existingLeads = (await OutboundLead.find({ pilotId: dataPilotId, email: { $ne: "" } }).lean()) as unknown as Array<Record<string, unknown>>;
    const existingEmails = new Map<string, LeadEmail>();
    for (const lead of existingLeads) {
      const dom = String(lead.accountDomain || "").toLowerCase().trim();
      const pk = String(lead.personKey || "");
      const status = String(lead.emailStatus || "");
      const email = String(lead.email || "");
      if (!dom || !email) continue;
      if (status === "verified" || status === "likely_to_engage") {
        existingEmails.set(`${dom}::${pk}`, { email, emailStatus: status as LeadEmail["emailStatus"] });
      }
    }

    async function persistEmails(rows: { domain: string; personKey: string; email: LeadEmail }[]) {
      for (const e of rows) {
        await OutboundLead.updateOne({ pilotId: dataPilotId, accountDomain: e.domain, personKey: e.personKey }, {
          $set: { email: e.email.email, emailStatus: e.email.emailStatus, updatedAt: new Date() },
        });
      }
    }

    const r = await emailMatchAgent({
      rows: stakeholder.rows,
      apolloCreditsBudget: (config.apolloCreditsBudget || 1500) - score.top.length,
      existingEmails,
      onBatch: persistEmails,
      shouldCancel: () => isCancelRequested(pilotId),
      signal,
    });
    return { state: r.state, result: r.output };
  });
  if (shouldStop("email_match")) { await OutboundPilot.findByIdAndUpdate(pilotId, { status: "paused", updatedAt: new Date() }); return; }

  const allStakeholderRows = stakeholder.rows
    .filter((r) => r.stakeholder)
    .map((r) => ({ account: r.account, stakeholder: r.stakeholder! }));

  const draftableLeadKeys = new Set(
    emailMatch.results
      .filter((e) => e.email.emailStatus === "verified" || e.email.emailStatus === "likely_to_engage")
      .map((e) => `${e.domain}::${e.personKey}`),
  );

  const research = startIdx > phaseIndex("research")
    ? await (async () => {
        const loaded = await loadLeadsForPilot(dataPilotId, score.top);
        const notes: { domain: string; research: LeadResearch }[] = [];
        for (const l of loaded) {
          if (l.research) notes.push({ domain: l.account.domain, research: l.research });
        }
        return { notes, llmTokensIn: 0, llmTokensOut: 0, tavilyCalls: 0, cacheHits: notes.length };
      })()
    : await runPhase(pilotId, "research", async ({ signal }) => {
        const existingLeads = (await OutboundLead.find({ pilotId: dataPilotId, observationAngle: { $ne: "" } }).lean()) as unknown as Array<Record<string, unknown>>;
        const existingNotes = new Map<string, LeadResearch>();
        for (const lead of existingLeads) {
          const dom = String(lead.accountDomain || "").toLowerCase().trim();
          const obs = String(lead.observationAngle || "").trim();
          if (dom && obs) {
            existingNotes.set(dom, {
              observationAngle: obs,
              secondaryObservation: String(lead.secondaryObservation || ""),
              signalForBody3: String(lead.signalForBody3 || ""),
              theirCustomers: String(lead.theirCustomers || ""),
              whatTheySell: String(lead.whatTheySell || ""),
              theirStage: String(lead.theirStage || ""),
              topPain: String(lead.topPain || ""),
              valueAngle: String(lead.valueAngle || ""),
              socialProofMatch: Array.isArray(lead.socialProofMatch) ? (lead.socialProofMatch as string[]) : [],
              subjectTopic: String(lead.subjectTopic || ""),
            });
          }
        }

        async function persistNote(n: { domain: string; research: LeadResearch }) {
          await OutboundLead.updateMany({ pilotId: dataPilotId, accountDomain: n.domain }, {
            $set: {
              observationAngle: n.research.observationAngle,
              secondaryObservation: n.research.secondaryObservation,
              signalForBody3: n.research.signalForBody3,
              theirCustomers: n.research.theirCustomers || "",
              whatTheySell: n.research.whatTheySell || "",
              theirStage: n.research.theirStage || "",
              topPain: n.research.topPain || "",
              valueAngle: n.research.valueAngle || "",
              socialProofMatch: n.research.socialProofMatch || [],
              subjectTopic: n.research.subjectTopic || "",
              updatedAt: new Date(),
            },
          });
        }

        const proofLib = config.socialProofLibrary && Object.keys(config.socialProofLibrary).length > 0
          ? config.socialProofLibrary
          : DEFAULT_SOCIAL_PROOF;
        const cb = doc.clientBrief || {};
        const briefForAgent = {
          sellerProduct: cb.sellerProduct || "",
          sellerOneLineValue: cb.sellerOneLineValue || "",
          sellerCapabilities: cb.sellerCapabilities || [],
          sellerUsps: cb.sellerUsps || [],
          targetSegments: cb.targetSegments || [],
          targetPersonas: cb.targetPersonas || [],
          commonPainsSolved: cb.commonPainsSolved || [],
          caseStudyWins: cb.caseStudyWins || [],
          antiIcp: cb.antiIcp || [],
          notes: cb.notes || "",
        };
        const seenDomains = new Set<string>();
        const accountLevelRows: typeof allStakeholderRows = [];
        for (const r of allStakeholderRows) {
          const dom = (r.account.domain || "").toLowerCase();
          if (seenDomains.has(dom)) continue;
          seenDomains.add(dom);
          accountLevelRows.push(r);
        }
        const r = await researchAgent({
          rows: accountLevelRows,
          existingNotes,
          onLead: persistNote,
          tavilyMaxLeads: config.useAi === true ? accountLevelRows.length : 0,
          useAi: config.useAi === true,
          socialProofLibrary: proofLib,
          shouldCancel: () => isCancelRequested(pilotId),
          signal,
          clientBrief: briefForAgent,
          sellerName: config.sellerName || "VWO",
        });
        return { state: r.state, result: r.output };
      });
  if (shouldStop("research")) { await OutboundPilot.findByIdAndUpdate(pilotId, { status: "paused", updatedAt: new Date() }); return; }

  const draftRows = allStakeholderRows
    .filter((r) => draftableLeadKeys.has(`${r.account.domain}::${r.stakeholder.personKey || ""}`))
    .map((r) => {
      const note = research.notes.find((n) => n.domain === r.account.domain);
      return {
        account: r.account,
        stakeholder: r.stakeholder,
        research: note?.research || { observationAngle: "", secondaryObservation: "", signalForBody3: "", theirCustomers: "", whatTheySell: "", theirStage: "", topPain: "", valueAngle: "", socialProofMatch: [], subjectTopic: "" },
      };
    });

  await runPhase(pilotId, "draft", async () => {
    const promptRows = draftRows.map((r) => {
      const pk = r.stakeholder.personKey || "";
      const lead = emailMatch.results.find((e) => e.domain === r.account.domain && e.personKey === pk);
      return {
        account: r.account,
        stakeholder: r.stakeholder,
        research: r.research,
        email: lead?.email.email || "",
        emailStatus: lead?.email.emailStatus || "",
      };
    });
    const pr = promptBuildAgent({ rows: promptRows, sellerName: config.sellerName || "VWO" });
    for (const p of pr.output.prompts) {
      await OutboundLead.updateOne({ pilotId: dataPilotId, accountDomain: p.domain, personKey: p.personKey }, {
        $set: { claudePrompt: p.prompt, updatedAt: new Date() },
      });
    }
    return { state: pr.state, result: pr.output };
  });
  if (shouldStop("draft")) { await OutboundPilot.findByIdAndUpdate(pilotId, { status: "paused", updatedAt: new Date() }); return; }

  await runPhase(pilotId, "validate", async () => {
    const leads = (await OutboundLead.find({ pilotId: dataPilotId, claudePrompt: { $ne: "" } }).lean()) as unknown as Array<Record<string, unknown>>;
    const promptInputs = leads.map((l) => ({
      domain: String(l.accountDomain || ""),
      personKey: String(l.personKey || ""),
      fullName: String(l.fullName || ""),
      prompt: String(l.claudePrompt || ""),
      hasEmail: !!String(l.email || ""),
    }));
    const r = validateAgent({ prompts: promptInputs });
    for (const rep of r.output.reports) {
      await OutboundLead.updateOne({ pilotId: dataPilotId, accountDomain: rep.domain, personKey: rep.personKey }, {
        $set: {
          validationIssues: rep.shippable ? [] : [rep.reason],
          shippable: rep.shippable,
          updatedAt: new Date(),
        },
      });
    }
    return { state: r.state, result: r.output };
  });
  if (shouldStop("validate")) { await OutboundPilot.findByIdAndUpdate(pilotId, { status: "paused", updatedAt: new Date() }); return; }

  const exportOut = await runPhase(pilotId, "export", async () => {
    const leadDocs = (await OutboundLead.find({ pilotId: dataPilotId }).sort({ rank: 1 }).lean()) as unknown as Array<Record<string, unknown>>;
    const accountByDomain = new Map(score.top.map((t) => [t.domain, t] as const));
    const str = (v: unknown) => typeof v === "string" ? v : "";
    const num = (v: unknown) => typeof v === "number" ? v : Number(v) || 0;
    const arr = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : [];
    const leads = leadDocs.map((l) => {
      const acc = accountByDomain.get(str(l.accountDomain).toLowerCase());
      return {
        email: str(l.email),
        emailStatus: str(l.emailStatus),
        firstName: str(l.firstName),
        lastName: str(l.lastName),
        fullName: str(l.fullName),
        companyShort: str(l.companyShort),
        companyFull: str(l.companyFull),
        domain: str(l.accountDomain),
        industry: str(l.industry),
        employees: num(l.employees),
        country: str(l.country),
        contactTitle: str(l.contactTitle),
        contactLinkedinUrl: str(l.contactLinkedinUrl),
        companyLinkedinUrl: acc?.linkedinUrl || "",
        score: num(l.score),
        segment: str(l.segment),
        observationAngle: str(l.observationAngle),
        topPain: str(l.topPain),
        valueAngle: str(l.valueAngle),
        socialProofMatch: arr(l.socialProofMatch).join(" · "),
        subjectTopic: str(l.subjectTopic),
        claudePrompt: str(l.claudePrompt),
        subject1: str(l.subject1),
        body1: str(l.body1),
        subject2: str(l.subject2),
        body2: str(l.body2),
        subject3: str(l.subject3),
        body3: str(l.body3),
      };
    });
    const r = exportClaudePasteAgent({ leads });
    return { state: r.state, result: r.output };
  });

  await OutboundPilot.findByIdAndUpdate(pilotId, {
    status: "ready",
    finalCsv: exportOut.csv,
    updatedAt: new Date(),
  });
}

export async function runPipelineSafe(pilotId: string, opts: { stopAfter?: PhaseKey; startFrom?: PhaseKey; testLimit?: number } = {}): Promise<void> {
  try {
    await runPipeline(pilotId, opts);
  } catch (err) {
    if (err instanceof PipelineCancelled) {
      await OutboundPilot.findByIdAndUpdate(pilotId, {
        status: "paused",
        cancelRequested: false,
        updatedAt: new Date(),
      });
      console.log("[outbound] pipeline stopped by user", pilotId);
      return;
    }
    throw err;
  }
}

export function nextRunnablePhase(phases: PhaseState[]): PhaseKey | null {
  for (const def of PHASE_DEFS) {
    const p = phases.find((x) => x.key === def.key);
    if (!p || p.status !== "complete") return def.key;
  }
  return null;
}
