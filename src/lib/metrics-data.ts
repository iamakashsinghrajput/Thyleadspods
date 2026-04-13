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

function generateDays(year: number, month: number, count: number, leadsRange: [number, number], accountsRange: [number, number]): DailyMetric[] {
  const days: DailyMetric[] = [];
  for (let d = 1; d <= count; d++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    days.push({
      date: `${year}-${mm}-${dd}`,
      leadsUploaded: Math.floor(Math.random() * (leadsRange[1] - leadsRange[0] + 1)) + leadsRange[0],
      accountsMined: Math.floor(Math.random() * (accountsRange[1] - accountsRange[0] + 1)) + accountsRange[0],
    });
  }
  return days;
}

const seed = (id: string): [number, number] => {
  const n = parseInt(id.replace("p", ""), 10);
  return [n * 2 + 3, n + 1];
};

export const clientMetrics: Record<string, ClientMetrics[]> = {};

const clientIds = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
for (const cid of clientIds) {
  const [lBase, aBase] = seed(cid);
  clientMetrics[cid] = [
    {
      clientId: cid,
      month: "April",
      year: 2026,
      dailyMetrics: generateDays(2026, 4, 9, [lBase, lBase + 12], [aBase, aBase + 8]),
    },
    {
      clientId: cid,
      month: "March",
      year: 2026,
      dailyMetrics: generateDays(2026, 3, 31, [lBase, lBase + 12], [aBase, aBase + 8]),
    },
  ];
}
