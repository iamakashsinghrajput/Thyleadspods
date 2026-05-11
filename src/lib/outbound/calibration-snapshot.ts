// Single source of truth for "what calibration is active right now."
// Used by: campaign-outcome persistence (snapshot at run start), audit routes (sign-off + diff),
// and the operator review loop runner.

export interface CalibrationSnapshot {
  skillVersion: string;
  sellerName: string;
  apifyDisabled: boolean;
  coreSignalTierAOnly: boolean;
  coreSignalCreditsBudget: number;
  bucketThresholds: number[];
  competitorPenaltyDirect: number;
  competitorPenaltyAdjacent: number;
  fiscalCalendarMultiplier: number;
  fiscalCalendarWindow: string;
  socialProofLibrarySize: number;
  exclusionGroupCount: number;
  intentSignalWeights: Record<string, number>;
  capturedAt: string;
}

const VWO_INTENT_WEIGHTS = {
  L1_fit: 25,
  L2a_hiring: 15,
  L2b_leadership: 18,
  L2c_funding: 4,
  L2d_growth: 6,
  L2e_news: 0,
  L2f_techStack: 12,
  L3_engagement: 20,
  L4_whyNow: 10,
};

function fiscalWindow(): { multiplier: number; window: string } {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  if (month === 9 && day >= 20) return { multiplier: 0.6, window: "diwali_blackout" };
  if (month === 10 && day <= 15) return { multiplier: 0.6, window: "diwali_blackout" };
  if (month === 2 && day >= 15) return { multiplier: 1.3, window: "fy_transition" };
  if (month === 3 && day <= 15) return { multiplier: 1.3, window: "fy_transition" };
  if (month === 3 && day > 15) return { multiplier: 0.9, window: "ipl_active" };
  if (month === 4) return { multiplier: 0.9, window: "ipl_active" };
  if (month === 7) return { multiplier: 0.85, window: "festive_prep" };
  if (month === 8 && day <= 15) return { multiplier: 0.85, window: "festive_prep" };
  if (month === 11 && day >= 20) return { multiplier: 0.85, window: "year_end_pause" };
  if (month === 0 && day <= 7) return { multiplier: 0.85, window: "year_end_pause" };
  return { multiplier: 1.0, window: "regular" };
}

export function buildCalibrationSnapshot(args: { sellerName?: string }): CalibrationSnapshot {
  const seller = (args.sellerName || "").toLowerCase();
  const isVwo = seller.includes("vwo") || seller.includes("wingify");
  const fc = fiscalWindow();
  const budgetRaw = Number(process.env.CORESIGNAL_CREDITS_BUDGET || "10");
  const budget = Number.isFinite(budgetRaw) && budgetRaw > 0 ? Math.floor(budgetRaw) : 10;

  return {
    skillVersion: "v7",
    sellerName: args.sellerName || "VWO",
    apifyDisabled: isVwo,
    coreSignalTierAOnly: true, // top 20%, min 3
    coreSignalCreditsBudget: budget,
    bucketThresholds: [95, 75, 55, 35],
    competitorPenaltyDirect: 0.2,
    competitorPenaltyAdjacent: 0.5,
    fiscalCalendarMultiplier: fc.multiplier,
    fiscalCalendarWindow: fc.window,
    socialProofLibrarySize: 30, // 9 segments × ~3 brands + default
    exclusionGroupCount: 15,    // HDFC/ICICI/Andaaz/POSist + 11 conglomerates
    intentSignalWeights: VWO_INTENT_WEIGHTS,
    capturedAt: new Date().toISOString(),
  };
}
