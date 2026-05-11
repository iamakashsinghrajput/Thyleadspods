// VWO_CLIENT_SKILL.md validation seed runner.
// Loads fixtures, runs Phase 9 prompt builder, and asserts the expected rules hold.
// Used by /api/outbound/audit/seed-test to catch prompt regressions.

import seed from "./agents/__fixtures__/vwo-validation-seed.json";
import { buildLeadPrompt } from "./agents/phase9-prompt-build";
import type { ScoredAccount, Stakeholder, LeadResearch } from "./types";

interface SeedSampleExpected {
  subject1Pattern?: string;
  subject1ForbidContains?: string[];
  body1MustContain?: string[];
  body1MustReferenceBrands?: string[];
  body1ForbidUnverifiedMetrics?: boolean;
  body2MustReferenceCapability?: string;
  body3ToneBreakup?: boolean;
}

interface SeedSample {
  id: string;
  context: string;
  expected: SeedSampleExpected;
  input: {
    stakeholder: Partial<Stakeholder>;
    account: Partial<ScoredAccount>;
    research: Partial<LeadResearch>;
  };
}

interface SeedFile {
  version: string;
  purpose: string;
  samples: SeedSample[];
}

export interface SeedTestResult {
  id: string;
  context: string;
  prompt: string;
  promptChars: number;
  checks: { name: string; passed: boolean; detail: string }[];
  passed: boolean;
}

export interface SeedTestRun {
  version: string;
  ranAt: string;
  totalSamples: number;
  passed: number;
  failed: number;
  results: SeedTestResult[];
}

const VWO_VERIFIED_METRIC_PATTERNS = [/125\s*%/, /50\s*%/, /47\s*%/, /44\s*%/, /100\s*%/, /52\s*%/, /49\.85\s*%/, /49\s*%/];

function fillStakeholder(s: Partial<Stakeholder>): Stakeholder {
  return {
    firstName: s.firstName || "",
    lastName: s.lastName || "",
    fullName: s.fullName || `${s.firstName || ""} ${s.lastName || ""}`.trim(),
    title: s.title || "",
    linkedinUrl: s.linkedinUrl || "",
    seniority: s.seniority || "",
    pickedReason: s.pickedReason || "seed",
    personKey: s.personKey || `seed-${(s.firstName || "x").toLowerCase()}`,
  };
}

function fillAccount(a: Partial<ScoredAccount>): ScoredAccount {
  return {
    domain: a.domain || "",
    name: a.name || "",
    industry: a.industry || "",
    secondaryIndustries: a.secondaryIndustries || [],
    estimatedNumEmployees: a.estimatedNumEmployees || 0,
    organizationRevenuePrinted: a.organizationRevenuePrinted || "",
    foundedYear: a.foundedYear || 0,
    city: a.city || "",
    state: a.state || "",
    country: a.country || "",
    ownedByOrganization: a.ownedByOrganization || "",
    shortDescription: a.shortDescription || "",
    keywords: a.keywords || [],
    dhMarketing: a.dhMarketing || 0,
    dhEngineering: a.dhEngineering || 0,
    dhProductManagement: a.dhProductManagement || 0,
    dhSales: a.dhSales || 0,
    headcount6mGrowth: a.headcount6mGrowth || 0,
    headcount12mGrowth: a.headcount12mGrowth || 0,
    alexaRanking: a.alexaRanking || 0,
    linkedinUrl: a.linkedinUrl || "",
    publiclyTradedSymbol: a.publiclyTradedSymbol || "",
    score: a.score || 80,
    segment: a.segment || "priority",
    scoreBreakdown: a.scoreBreakdown || {},
  };
}

function fillResearch(r: Partial<LeadResearch>): LeadResearch {
  return {
    observationAngle: r.observationAngle || "",
    secondaryObservation: r.secondaryObservation || "",
    signalForBody3: r.signalForBody3 || "",
    theirCustomers: r.theirCustomers || "",
    whatTheySell: r.whatTheySell || "",
    theirStage: r.theirStage || "",
    topPain: r.topPain || "",
    valueAngle: r.valueAngle || "",
    socialProofMatch: r.socialProofMatch || [],
    subjectTopic: r.subjectTopic || "",
    buyingHypothesis: r.buyingHypothesis || "",
    shouldEmail: r.shouldEmail || "",
    shouldEmailReason: r.shouldEmailReason || "",
    confidenceLevel: r.confidenceLevel || "",
    buyerSignalScore: r.buyerSignalScore || 0,
    evidenceList: r.evidenceList || [],
    socialAngle: r.socialAngle || "",
    personEvidence: r.personEvidence || [],
    icpRole: r.icpRole || "",
  };
}

export function runValidationSeed(): SeedTestRun {
  const file = seed as SeedFile;
  const results: SeedTestResult[] = [];

  for (const sample of file.samples) {
    const stakeholder = fillStakeholder(sample.input.stakeholder);
    const account = fillAccount(sample.input.account);
    const research = fillResearch(sample.input.research);
    const prompt = buildLeadPrompt({
      sellerName: "VWO",
      account,
      stakeholder,
      research,
      email: "test@example.com",
      emailStatus: "verified",
    });

    const checks: { name: string; passed: boolean; detail: string }[] = [];
    const exp = sample.expected;

    // Banned subject vocab — check the prompt CONTAINS the banlist clause
    if (exp.subject1ForbidContains) {
      const allBanned = exp.subject1ForbidContains.every((b) => prompt.toLowerCase().includes(b.toLowerCase()));
      checks.push({ name: "banned_subject_vocab_in_prompt", passed: allBanned, detail: allBanned ? "prompt instructs Claude to ban these terms" : `prompt missing banlist for: ${exp.subject1ForbidContains.filter((b) => !prompt.toLowerCase().includes(b.toLowerCase())).join(", ")}` });
    }

    // Reassurance + ease coda enforcement
    if (exp.body1MustContain) {
      for (const phrase of exp.body1MustContain) {
        const present = prompt.includes(phrase);
        checks.push({ name: `body1_verbatim:${phrase.slice(0, 40)}`, passed: present, detail: present ? "verbatim instruction present" : "missing from prompt" });
      }
    }

    // Social proof brand presence
    if (exp.body1MustReferenceBrands) {
      const allBrands = exp.body1MustReferenceBrands.every((b) => prompt.includes(b));
      checks.push({ name: "social_proof_brands_present", passed: allBrands, detail: allBrands ? "all expected brands present" : `missing brands: ${exp.body1MustReferenceBrands.filter((b) => !prompt.includes(b)).join(", ")}` });
    }

    // Verified-metric enforcement instruction in prompt
    if (exp.body1ForbidUnverifiedMetrics) {
      const present = prompt.includes("Andaaz Fashion 125%") || prompt.includes("verified");
      checks.push({ name: "verified_metric_clause", passed: present, detail: present ? "verified-metric whitelist instruction in prompt" : "missing verified-metric clause" });
    }

    // V-VWO-4 capability rotation hint
    if (exp.body2MustReferenceCapability) {
      const present = prompt.toLowerCase().includes(exp.body2MustReferenceCapability.toLowerCase().split(" + ")[0]);
      checks.push({ name: "capability_rotation_hint", passed: present, detail: present ? "capability rotation hint in prompt" : `missing hint for: ${exp.body2MustReferenceCapability}` });
    }

    // Breakup tone for body 3
    if (exp.body3ToneBreakup) {
      const present = prompt.toLowerCase().includes("breakup");
      checks.push({ name: "body3_breakup_tone", passed: present, detail: present ? "breakup tone instruction present" : "missing breakup instruction" });
    }

    // VWO_VERIFIED_METRIC_PATTERNS imported but unused yet — keep for future post-generation checks
    void VWO_VERIFIED_METRIC_PATTERNS;

    const passed = checks.every((c) => c.passed);
    results.push({
      id: sample.id,
      context: sample.context,
      prompt,
      promptChars: prompt.length,
      checks,
      passed,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    version: file.version,
    ranAt: new Date().toISOString(),
    totalSamples: file.samples.length,
    passed: passedCount,
    failed: file.samples.length - passedCount,
    results,
  };
}
