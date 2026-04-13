export interface DailyMetric {
  date: string;
  leadsUploaded: number;
  accountsMined: number;
}

export interface ClientMetrics {
  clientId: string;
  month: string;
  year: number;
  dailyMetrics: DailyMetric[];
}

export const clientMetrics: Record<string, ClientMetrics[]> = {
  p1: [
    { clientId: "p1", month: "April", year: 2026, dailyMetrics: [] },
  ],
  p2: [
    { clientId: "p2", month: "April", year: 2026, dailyMetrics: [
      { date: "2026-04-01", leadsUploaded: 205, accountsMined: 0 },
      { date: "2026-04-02", leadsUploaded: 201, accountsMined: 0 },
      { date: "2026-04-03", leadsUploaded: 208, accountsMined: 0 },
      { date: "2026-04-06", leadsUploaded: 190, accountsMined: 0 },
    ]},
  ],
  p3: [
    { clientId: "p3", month: "April", year: 2026, dailyMetrics: [
      { date: "2026-04-02", leadsUploaded: 130, accountsMined: 0 },
      { date: "2026-04-03", leadsUploaded: 110, accountsMined: 0 },
    ]},
  ],
  p4: [
    { clientId: "p4", month: "April", year: 2026, dailyMetrics: [
      { date: "2026-04-03", leadsUploaded: 0, accountsMined: 280 },
    ]},
  ],
  p5: [
    { clientId: "p5", month: "April", year: 2026, dailyMetrics: [
      { date: "2026-04-02", leadsUploaded: 195, accountsMined: 0 },
      { date: "2026-04-03", leadsUploaded: 236, accountsMined: 0 },
    ]},
  ],
  p6: [
    { clientId: "p6", month: "April", year: 2026, dailyMetrics: [
      { date: "2026-04-01", leadsUploaded: 448, accountsMined: 0 },
      { date: "2026-04-03", leadsUploaded: 307, accountsMined: 0 },
      { date: "2026-04-06", leadsUploaded: 460, accountsMined: 0 },
    ]},
  ],
  p7: [
    { clientId: "p7", month: "April", year: 2026, dailyMetrics: [
      { date: "2026-04-02", leadsUploaded: 154, accountsMined: 0 },
      { date: "2026-04-03", leadsUploaded: 372, accountsMined: 0 },
    ]},
  ],
  p8: [
    { clientId: "p8", month: "April", year: 2026, dailyMetrics: [
      { date: "2026-04-02", leadsUploaded: 328, accountsMined: 0 },
    ]},
  ],
  p9: [
    { clientId: "p9", month: "April", year: 2026, dailyMetrics: [] },
  ],
  p10: [
    { clientId: "p10", month: "April", year: 2026, dailyMetrics: [] },
  ],
  p11: [
    { clientId: "p11", month: "April", year: 2026, dailyMetrics: [] },
  ],
  p12: [
    { clientId: "p12", month: "April", year: 2026, dailyMetrics: [] },
  ],
};
