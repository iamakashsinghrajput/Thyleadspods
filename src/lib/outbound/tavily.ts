export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  query: string;
  answer: string;
  results: TavilySearchResult[];
}

export function isTavilyLive(): boolean {
  return !!(process.env.TAVILY_API_KEY || "").trim();
}

export async function tavilySearch(query: string, opts: { searchDepth?: "basic" | "advanced"; maxResults?: number; includeDomains?: string[]; signal?: AbortSignal } = {}): Promise<TavilySearchResponse> {
  const apiKey = (process.env.TAVILY_API_KEY || "").trim();
  if (!apiKey) throw new Error("TAVILY_API_KEY missing");

  const { withTimeout, TAVILY_FETCH_TIMEOUT_MS } = await import("./fetch-signal");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: opts.searchDepth || "advanced",
      include_answer: true,
      include_raw_content: false,
      max_results: opts.maxResults ?? 5,
      ...(opts.includeDomains && opts.includeDomains.length > 0 ? { include_domains: opts.includeDomains } : {}),
    }),
    signal: withTimeout(opts.signal, TAVILY_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);

  type Raw = {
    query?: string;
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
  };
  const data = (await res.json()) as Raw;
  return {
    query: data.query || query,
    answer: data.answer || "",
    results: (data.results || []).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      content: r.content || "",
      score: r.score || 0,
    })),
  };
}

export async function tavilyExtract(urls: string[], opts: { extractDepth?: "basic" | "advanced" } = {}): Promise<{ url: string; rawContent: string }[]> {
  const apiKey = (process.env.TAVILY_API_KEY || "").trim();
  if (!apiKey) throw new Error("TAVILY_API_KEY missing");

  const res = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      urls,
      extract_depth: opts.extractDepth || "basic",
    }),
  });
  if (!res.ok) throw new Error(`tavily extract ${res.status}: ${(await res.text()).slice(0, 200)}`);

  type Raw = {
    results?: Array<{ url?: string; raw_content?: string }>;
  };
  const data = (await res.json()) as Raw;
  return (data.results || []).map((r) => ({
    url: r.url || "",
    rawContent: r.raw_content || "",
  }));
}

export function summarizeForObservation(domain: string, search: TavilySearchResponse): string {
  const lines: string[] = [];
  if (search.answer) lines.push(`SUMMARY: ${search.answer}`);
  for (const r of search.results.slice(0, 5)) {
    if (r.content) lines.push(`- ${r.title || r.url}: ${r.content.slice(0, 280).replace(/\s+/g, " ").trim()}`);
  }
  return lines.join("\n").slice(0, 2400) || `(no Tavily results for ${domain})`;
}
