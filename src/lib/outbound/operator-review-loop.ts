// VWO_CLIENT_SKILL.md operator review loop — root-cause implementation, not a patch.
// Compares recent CampaignOutcome rows against the current calibration and produces a
// digest the operator reviews before any change is applied.
//
// 6 sub-loops per the doc:
//   Loop 1: ICP refinement (which industry buckets converted vs scoring expectations)
//   Loop 2: Scoring calibration (which signals predicted conversion best)
//   Loop 3: Observation angle effectiveness (which CATEGORY_HINT segments shipped vs flagged)
//   Loop 4: Subject pattern A/B (top vs bottom subject lines by reply rate)
//   Loop 5: Exclusion universe expansion (sister-brand hits trending up)
//   Loop 6: Persona research ROI (Tier-A CoreSignal cost vs Tier-B baseline outcome diff)
//
// Each loop produces: input data, current expectation, observed gap, recommendation.
// Recommendations are NOT auto-applied — they're surfaced for operator sign-off.

import OutboundCampaignOutcome from "@/lib/models/outbound/campaign-outcome";

interface OutcomeRow {
  pilotId: string;
  runId: string;
  startedAt: Date;
  completedAt?: Date;
  status: string;
  calibrationSnapshot?: { skillVersion?: string; sellerName?: string; fiscalCalendarWindow?: string };
  inputs?: { coreSignalOnly?: boolean };
  filterStats?: { eligible?: number; excluded?: number; groupHits?: number; antiIcpHits?: number };
  scoreStats?: { bucketHot?: number; bucketPriority?: number; bucketActive?: number; bucketNurture?: number; bucketExcluded?: number; avgScore?: number };
  emailStats?: { verified?: number; creditsUsed?: number };
  validationStats?: { shippable?: number; vwoIssues?: number };
  postCampaign?: { emailsSent?: number; replies?: number; meetingsBooked?: number };
}

export interface LoopFinding {
  loop: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  observation: string;
  recommendation: string;
  severity: "info" | "watch" | "action";
  evidence: Record<string, unknown>;
}

export interface OperatorReviewDigest {
  generatedAt: string;
  windowDays: number;
  outcomesAnalysed: number;
  findings: LoopFinding[];
  rawSummary: {
    avgEligibleRate: number;
    avgGroupHitsPerRun: number;
    avgAntiIcpHitsPerRun: number;
    avgVwoIssuesPerRun: number;
    avgShippablePerRun: number;
    avgScore: number;
    runsWithPostCampaignData: number;
    avgReplyRate: number;
    avgMeetingRate: number;
  };
}

const DEFAULT_WINDOW_DAYS = 28;

export async function runOperatorReviewLoop(opts: { windowDays?: number; pilotId?: string } = {}): Promise<OperatorReviewDigest> {
  const windowDays = opts.windowDays && opts.windowDays > 0 ? opts.windowDays : DEFAULT_WINDOW_DAYS;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const filter: Record<string, unknown> = { startedAt: { $gte: since }, status: "complete" };
  if (opts.pilotId) filter.pilotId = opts.pilotId;

  const docs = (await OutboundCampaignOutcome.find(filter).sort({ startedAt: -1 }).lean()) as unknown as OutcomeRow[];

  const findings: LoopFinding[] = [];

  if (docs.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      windowDays,
      outcomesAnalysed: 0,
      findings: [{
        loop: 1,
        title: "No completed runs in window",
        observation: `Zero CampaignOutcome rows with status="complete" in the last ${windowDays} days.`,
        recommendation: "Run a campaign first. Operator review loop has nothing to analyse yet.",
        severity: "info",
        evidence: { since: since.toISOString() },
      }],
      rawSummary: { avgEligibleRate: 0, avgGroupHitsPerRun: 0, avgAntiIcpHitsPerRun: 0, avgVwoIssuesPerRun: 0, avgShippablePerRun: 0, avgScore: 0, runsWithPostCampaignData: 0, avgReplyRate: 0, avgMeetingRate: 0 },
    };
  }

  const num = (v: unknown) => typeof v === "number" ? v : Number(v) || 0;
  const sumBy = (rows: OutcomeRow[], pick: (r: OutcomeRow) => number) => rows.reduce((a, r) => a + pick(r), 0);
  const avgBy = (rows: OutcomeRow[], pick: (r: OutcomeRow) => number) => rows.length === 0 ? 0 : sumBy(rows, pick) / rows.length;

  const avgEligibleRate = avgBy(docs, (r) => {
    const totalIn = num(r.filterStats?.eligible) + num(r.filterStats?.excluded);
    return totalIn === 0 ? 0 : num(r.filterStats?.eligible) / totalIn;
  });
  const avgGroupHitsPerRun = avgBy(docs, (r) => num(r.filterStats?.groupHits));
  const avgAntiIcpHitsPerRun = avgBy(docs, (r) => num(r.filterStats?.antiIcpHits));
  const avgVwoIssuesPerRun = avgBy(docs, (r) => num(r.validationStats?.vwoIssues));
  const avgShippablePerRun = avgBy(docs, (r) => num(r.validationStats?.shippable));
  const avgScore = avgBy(docs, (r) => num(r.scoreStats?.avgScore));

  const withPost = docs.filter((r) => num(r.postCampaign?.emailsSent) > 0);
  const avgReplyRate = withPost.length === 0 ? 0 : avgBy(withPost, (r) => num(r.postCampaign?.replies) / Math.max(1, num(r.postCampaign?.emailsSent)));
  const avgMeetingRate = withPost.length === 0 ? 0 : avgBy(withPost, (r) => num(r.postCampaign?.meetingsBooked) / Math.max(1, num(r.postCampaign?.emailsSent)));

  // Loop 1 — ICP refinement
  if (avgEligibleRate < 0.30) {
    findings.push({
      loop: 1,
      title: "Eligibility rate below 30%",
      observation: `Across ${docs.length} runs, only ${(avgEligibleRate * 100).toFixed(1)}% of targets passed Phase 2 filter. Most are excluded before scoring.`,
      recommendation: "Audit your input target list — too many DNC/active customers/anti-ICP domains slipping in. Consider tightening upstream selection.",
      severity: "watch",
      evidence: { avgEligibleRate, runs: docs.length },
    });
  } else {
    findings.push({
      loop: 1,
      title: "Eligibility rate healthy",
      observation: `Average eligibility rate ${(avgEligibleRate * 100).toFixed(1)}% across ${docs.length} runs.`,
      recommendation: "No action needed. Continue current sourcing.",
      severity: "info",
      evidence: { avgEligibleRate, runs: docs.length },
    });
  }

  // Loop 2 — Scoring calibration (correlation between avgScore and reply rate when postCampaign data available)
  if (withPost.length >= 3) {
    const correlation = simpleCorrelation(
      withPost.map((r) => num(r.scoreStats?.avgScore)),
      withPost.map((r) => num(r.postCampaign?.replies) / Math.max(1, num(r.postCampaign?.emailsSent))),
    );
    findings.push({
      loop: 2,
      title: "Scoring vs reply-rate correlation",
      observation: `Pearson correlation between run-level avgScore and reply rate: ${correlation.toFixed(2)} (n=${withPost.length}).`,
      recommendation: correlation < 0.2
        ? "Weak correlation — consider rebalancing intent signal weights. Check if L2b leadership / L2f tech-stack signals are firing."
        : correlation < 0.5
          ? "Moderate correlation. Calibration is roughly aligned. Watch over next 4 weeks."
          : "Strong correlation. Scoring is predictive. Hold weights.",
      severity: correlation < 0.2 ? "action" : correlation < 0.5 ? "watch" : "info",
      evidence: { correlation, sampleSize: withPost.length },
    });
  } else {
    findings.push({
      loop: 2,
      title: "Insufficient post-campaign data for scoring calibration",
      observation: `Only ${withPost.length} runs have postCampaign metrics recorded. Need ≥3 for correlation.`,
      recommendation: "Operator: record emailsSent + replies + meetingsBooked per completed run via POST /api/outbound/audit/post-campaign.",
      severity: "watch",
      evidence: { runsWithPost: withPost.length, runsTotal: docs.length },
    });
  }

  // Loop 3 — Observation angle effectiveness (proxy via vwoIssues rate)
  const vwoIssueRate = avgShippablePerRun === 0 ? 0 : avgVwoIssuesPerRun / Math.max(1, avgShippablePerRun + avgVwoIssuesPerRun);
  if (vwoIssueRate > 0.10) {
    findings.push({
      loop: 3,
      title: "VWO validation issues exceed 10%",
      observation: `Avg ${avgVwoIssuesPerRun.toFixed(1)} VWO rule violations per run; ${(vwoIssueRate * 100).toFixed(1)}% of validated leads have V-VWO-2/5/6 issues.`,
      recommendation: "Audit recent prompts. Likely causes: (a) banned subject vocab leaking, (b) reassurance line missing, (c) unverified metric quoted. Tighten Phase 9 prompt instructions or fix the underlying data feeding the prompt.",
      severity: "action",
      evidence: { vwoIssueRate, avgVwoIssuesPerRun, avgShippablePerRun },
    });
  } else {
    findings.push({
      loop: 3,
      title: "Validation rules holding",
      observation: `${(vwoIssueRate * 100).toFixed(1)}% issue rate across runs. V-VWO-2/5/6 enforcement working.`,
      recommendation: "Hold current prompt builder.",
      severity: "info",
      evidence: { vwoIssueRate },
    });
  }

  // Loop 4 — Subject patterns (placeholder — needs subject-level reply data we don't capture yet)
  findings.push({
    loop: 4,
    title: "Subject pattern A/B (data gap)",
    observation: "Per-subject reply data not currently captured. Requires Smartlead webhook integration to pull reply attribution back into CampaignOutcome.",
    recommendation: "Wire Smartlead → POST /api/outbound/audit/post-campaign per email send so subject-level reply rates can be measured.",
    severity: "watch",
    evidence: {},
  });

  // Loop 5 — Exclusion universe expansion
  if (avgGroupHitsPerRun > 5) {
    findings.push({
      loop: 5,
      title: "Sister-brand exclusions trending up",
      observation: `Average ${avgGroupHitsPerRun.toFixed(1)} group/sister-brand hits per run — strong signal that target lists keep including known VWO customer groups.`,
      recommendation: "Refresh upstream target sourcing to filter VWO customer holding-company brands BEFORE Phase 2. Consider expanding VWO_GROUP_EXCLUSION_ROOTS if new groups appear.",
      severity: "action",
      evidence: { avgGroupHitsPerRun },
    });
  } else if (avgGroupHitsPerRun > 1) {
    findings.push({
      loop: 5,
      title: "Sister-brand exclusions in normal range",
      observation: `${avgGroupHitsPerRun.toFixed(1)} group hits per run — exclusion expansion catching expected drift.`,
      recommendation: "No action needed. Continue quarterly refresh.",
      severity: "info",
      evidence: { avgGroupHitsPerRun },
    });
  } else {
    findings.push({
      loop: 5,
      title: "Sister-brand exclusion catching nothing",
      observation: `${avgGroupHitsPerRun.toFixed(1)} group hits per run. Either source list is already pre-filtered, or exclusion patterns are too narrow.`,
      recommendation: "Audit a sample target list manually to confirm — make sure HDFC/ICICI/Andaaz Group brands aren't slipping through.",
      severity: "watch",
      evidence: { avgGroupHitsPerRun },
    });
  }

  // Loop 6 — Persona research ROI
  const csOnlyRuns = docs.filter((r) => r.inputs?.coreSignalOnly === true);
  const nonCsRuns = docs.filter((r) => !r.inputs?.coreSignalOnly);
  if (csOnlyRuns.length >= 2 && nonCsRuns.length >= 2) {
    const csShippable = avgBy(csOnlyRuns, (r) => num(r.validationStats?.shippable));
    const baselineShippable = avgBy(nonCsRuns, (r) => num(r.validationStats?.shippable));
    const delta = csShippable - baselineShippable;
    findings.push({
      loop: 6,
      title: "CoreSignal Tier-A vs baseline output delta",
      observation: `CoreSignal-only runs produce avg ${csShippable.toFixed(1)} shippable leads vs ${baselineShippable.toFixed(1)} baseline (delta ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}).`,
      recommendation: delta < 0
        ? "Tier-A CoreSignal cost not paying off vs baseline. Reduce CoreSignal credit budget or tighten Tier-A ratio."
        : delta < 2
          ? "Marginal lift — keep but monitor."
          : "CoreSignal Tier-A pulling its weight. Continue.",
      severity: delta < 0 ? "action" : delta < 2 ? "watch" : "info",
      evidence: { csShippable, baselineShippable, delta, csRuns: csOnlyRuns.length, baselineRuns: nonCsRuns.length },
    });
  } else {
    findings.push({
      loop: 6,
      title: "Insufficient runs to compare CoreSignal Tier-A ROI",
      observation: `Need ≥2 of each (csOnly: ${csOnlyRuns.length}, baseline: ${nonCsRuns.length}) to compare.`,
      recommendation: "Run more campaigns with both modes to enable comparison.",
      severity: "info",
      evidence: { csOnlyRuns: csOnlyRuns.length, baselineRuns: nonCsRuns.length },
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    outcomesAnalysed: docs.length,
    findings,
    rawSummary: {
      avgEligibleRate,
      avgGroupHitsPerRun,
      avgAntiIcpHitsPerRun,
      avgVwoIssuesPerRun,
      avgShippablePerRun,
      avgScore,
      runsWithPostCampaignData: withPost.length,
      avgReplyRate,
      avgMeetingRate,
    },
  };
}

function simpleCorrelation(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}
