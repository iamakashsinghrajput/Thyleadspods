import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

interface ProbeResult {
  ok: boolean;
  latencyMs?: number;
  status?: number;
  error?: string;
  detail?: string;
}

interface IntegrationStatus {
  name: "anthropic" | "tavily" | "coresignal" | "apollo" | "apify";
  envVar: string;
  configured: boolean;
  keyPreview: string;
  baseUrl?: string;
  probe?: ProbeResult;
}

function maskKey(k: string): string {
  if (!k) return "";
  const t = k.trim();
  if (t.length <= 8) return "****";
  return `${t.slice(0, 4)}…${t.slice(-4)} (${t.length} chars)`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function probeAnthropic(): Promise<ProbeResult> {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) return { ok: false, error: "ANTHROPIC_API_KEY missing" };
  const start = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "say ok" }],
      }),
    }, 15000);
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, latencyMs, status: res.status, error: txt.slice(0, 200) };
    }
    const data = (await res.json()) as { model?: string; usage?: { input_tokens?: number; output_tokens?: number } };
    return { ok: true, latencyMs, status: 200, detail: `model=${data.model || "?"} · in=${data.usage?.input_tokens || 0} out=${data.usage?.output_tokens || 0}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "unknown" };
  }
}

async function probeTavily(): Promise<ProbeResult> {
  const key = (process.env.TAVILY_API_KEY || "").trim();
  if (!key) return { ok: false, error: "TAVILY_API_KEY missing" };
  const start = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query: "tavily integration probe", max_results: 1, search_depth: "basic", include_answer: false }),
    }, 15000);
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, latencyMs, status: res.status, error: txt.slice(0, 200) };
    }
    const data = (await res.json()) as { results?: unknown[] };
    return { ok: true, latencyMs, status: 200, detail: `results=${(data.results || []).length}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "unknown" };
  }
}

async function probeCoreSignal(): Promise<ProbeResult> {
  const key = (process.env.CORESIGNAL_API_KEY || "").trim();
  if (!key) return { ok: false, error: "CORESIGNAL_API_KEY missing" };
  const overrideBase = (process.env.CORESIGNAL_BASE_URL || "").replace(/\/+$/, "");

  // 1. Try RapidAPI proxy (different host + headers)
  const rapidApiHosts = [
    "coresignal-coresignal-default.p.rapidapi.com",
    "coresignal.p.rapidapi.com",
  ];
  for (const host of rapidApiHosts) {
    try {
      const res = await fetchWithTimeout(`https://${host}/cdapi/v2/company_multi_source/search/filter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-RapidAPI-Key": key,
          "X-RapidAPI-Host": host,
        },
        body: JSON.stringify({ website: "google.com" }),
      }, 12000);
      if (res.status === 200) {
        const data = (await res.json()) as unknown[];
        return { ok: true, latencyMs: 0, status: 200, detail: `RAPIDAPI host=${host} · hits=${Array.isArray(data) ? data.length : 0} — set CORESIGNAL_BASE_URL to https://${host}/cdapi/v2/company_multi_source AND tell client to use X-RapidAPI-Key header (not implemented yet — let me know to wire it)` };
      }
      if (res.status !== 404) {
        return { ok: false, latencyMs: 0, status: res.status, error: `RapidAPI host ${host} responded ${res.status} — your key looks like it might be for RapidAPI's CoreSignal proxy, not direct CoreSignal. Confirm where you got the key from.` };
      }
    } catch {}
  }

  // 2. Key-validity probes against direct CoreSignal
  const validityProbes = [
    "https://api.coresignal.com/cdapi/v2/credits",
    "https://api.coresignal.com/cdapi/v1/credits",
    "https://api.coresignal.com/v1/credits",
    "https://api.coresignal.com/v2/credits",
    "https://api.coresignal.com/credits",
    "https://api.coresignal.com/api/credits",
    "https://api.coresignal.com/cdapi/v2/account/credits",
    "https://api.coresignal.com/cdapi/v1/account/credits",
  ];
  let keyValidStatus: number | null = null;
  let keyValidPath: string | null = null;
  for (const u of validityProbes) {
    try {
      const res = await fetchWithTimeout(u, {
        method: "GET",
        headers: { "apikey": key, "Authorization": `Bearer ${key}`, "X-API-KEY": key },
      }, 8000);
      if (res.status === 200 || res.status === 401 || res.status === 403) {
        keyValidStatus = res.status;
        keyValidPath = u.replace("https://api.coresignal.com", "");
        break;
      }
    } catch {}
  }

  // Each entry: [url, body]. Try es_dsl-shaped body for /search/es_dsl, plain filter for /search/filter.
  const esDslBody = { query: { bool: { must: [{ match: { website: "google.com" } }] } } };
  const filterBody: Record<string, unknown> = { website: "google.com" };
  const candidatesWithBody: Array<{ url: string; body: Record<string, unknown> }> = [
    overrideBase ? { url: `${overrideBase}/search/es_dsl`, body: esDslBody } : null,
    overrideBase ? { url: `${overrideBase}/search/filter`, body: filterBody } : null,
    overrideBase ? { url: `${overrideBase}/company_base/search/es_dsl`, body: esDslBody } : null,
    overrideBase ? { url: `${overrideBase}/company_multi_source/search/filter`, body: filterBody } : null,
    { url: "https://api.coresignal.com/cdapi/v2/company_base/search/es_dsl", body: esDslBody },
    { url: "https://api.coresignal.com/cdapi/v2/company_base/search/filter", body: filterBody },
    { url: "https://api.coresignal.com/cdapi/v2/company_multi_source/search/filter", body: filterBody },
    { url: "https://api.coresignal.com/cdapi/v2/company_multi_source/search/es_dsl", body: esDslBody },
    { url: "https://api.coresignal.com/cdapi/v2/multi_source_company/search/filter", body: filterBody },
    { url: "https://api.coresignal.com/cdapi/v2/professional_network_company/search/filter", body: filterBody },
    { url: "https://api.coresignal.com/cdapi/v2/companies/search/filter", body: filterBody },
    { url: "https://api.coresignal.com/cdapi/v1/multi_source/company/search/filter", body: filterBody },
    { url: "https://api.coresignal.com/cdapi/v1/professional_network/company/search/filter", body: filterBody },
    { url: "https://api.coresignal.com/cdapi/v1/linkedin/company/search/filter", body: filterBody },
    { url: "https://api.coresignal.com/cdapi/v1/companies/search/filter", body: filterBody },
  ].filter(Boolean) as Array<{ url: string; body: Record<string, unknown> }>;
  const candidates = candidatesWithBody.map((c) => c.url);

  // Try each path with EACH single auth header in isolation (some gateways reject ambiguous multi-auth)
  const authHeaderSets: Array<Record<string, string>> = [
    { "apikey": key },
    { "Authorization": `Bearer ${key}` },
    { "Authorization": key },
    { "X-API-KEY": key },
  ];

  const attempts: string[] = [];
  let firstAuthError: { status: number; path: string; auth: string; body: string } | null = null;
  const start = Date.now();
  for (const candidate of candidatesWithBody) {
    const url = candidate.url;
    let bestStatus: number | null = null;
    let bestBody = "";
    for (const auth of authHeaderSets) {
      const t0 = Date.now();
      try {
        const res = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...auth },
          body: JSON.stringify(candidate.body),
        }, 10000);
        const dt = Date.now() - t0;
        const shortPath = url.replace("https://api.coresignal.com", "").replace("https://api-prod.coresignal.com", "PROD");
        const authName = Object.keys(auth)[0];
        if (res.status === 200) {
          const data = (await res.json()) as unknown[];
          return { ok: true, latencyMs: Date.now() - start, status: 200, detail: `path=${shortPath} · auth=${authName} · hits=${Array.isArray(data) ? data.length : 0} · ${dt}ms` };
        }
        if (res.status === 401 || res.status === 403) {
          const txt = await res.text().catch(() => "");
          if (!firstAuthError) {
            firstAuthError = { status: res.status, path: shortPath, auth: authName, body: txt.slice(0, 200) };
          }
          if (bestStatus === null || res.status < bestStatus) {
            bestStatus = res.status;
            bestBody = txt.slice(0, 100);
          }
          continue;
        }
        if (res.status !== 404 && (bestStatus === null || res.status < (bestStatus || 999))) {
          bestStatus = res.status;
          bestBody = (await res.text().catch(() => "")).slice(0, 100);
        }
      } catch {}
    }
    const shortPath = url.replace("https://api.coresignal.com", "").replace("https://api-prod.coresignal.com", "PROD");
    if (bestStatus !== null) {
      attempts.push(`${bestStatus} ${shortPath}`);
    } else {
      attempts.push(`404 ${shortPath}`);
    }
    void bestBody;
  }

  if (firstAuthError) {
    const isAccessIssue = /credits|access|product|plan|tier|subscription/i.test(firstAuthError.body);
    const guidance = isAccessIssue
      ? `Your key is recognised by CoreSignal but does NOT have access to this dataset. Open https://dashboard.coresignal.com → API → check which products are enabled (e.g., Company Multi-Source vs Company Base). Buy/enable the right one or use a key that has it.`
      : `Tried 4 auth header formats — all rejected. The key might be revoked, regenerated, or copied with extra whitespace/quotes. Re-copy from https://dashboard.coresignal.com → API Keys (NO surrounding quotes when pasting into .env.local).`;
    return {
      ok: false,
      latencyMs: Date.now() - start,
      status: firstAuthError.status,
      error: `Path ${firstAuthError.path} exists, but key was rejected (${firstAuthError.status}) on every auth header (apikey, Authorization Bearer, X-API-KEY, raw). Server response: ${firstAuthError.body || "(empty)"}. ${guidance}`,
    };
  }

  const keyHint = keyValidStatus === 200
    ? `Key IS valid (${keyValidPath} returned 200) but no known company-search path matches your tier.`
    : keyValidStatus === 401 || keyValidStatus === 403
      ? `Key was rejected by ${keyValidPath} (${keyValidStatus}) — likely revoked or wrong key.`
      : `Could not validate key against any /credits endpoint either — your account base may be different.`;

  return {
    ok: false,
    latencyMs: Date.now() - start,
    status: 404,
    error: `${keyHint} Fix: open https://dashboard.coresignal.com → API Reference → click any POST endpoint (e.g. "Company Multi-source · Search by filter") → copy the cURL example URL. Then set CORESIGNAL_BASE_URL in .env.local to that URL up to (NOT including) /search/filter. Examples: "https://api.coresignal.com/cdapi/v2/company_multi_source" or "https://api.coresignal.com/cdapi/v2/employee_multi_source". Tried ${attempts.length} paths: ${attempts.slice(0, 6).join(", ")}.`,
  };
}

async function probeApollo(): Promise<ProbeResult> {
  const key = (process.env.APOLLO_API_KEY || "").trim();
  if (!key) return { ok: false, error: "APOLLO_API_KEY missing" };
  const start = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({
        q_organization_domains_list: ["google.com"],
        person_titles: ["ceo"],
        include_similar_titles: true,
        per_page: 1,
      }),
    }, 15000);
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, latencyMs, status: res.status, error: txt.slice(0, 200) };
    }
    const data = (await res.json()) as { people?: unknown[]; contacts?: unknown[] };
    return { ok: true, latencyMs, status: 200, detail: `people=${(data.people || data.contacts || []).length}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "unknown" };
  }
}

async function probeApify(): Promise<ProbeResult> {
  const key = (process.env.APIFY_API_KEY || "").trim();
  if (!key) return { ok: false, error: "APIFY_API_KEY missing" };
  const base = (process.env.APIFY_BASE_URL || "https://api.apify.com/v2").replace(/\/+$/, "");
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(`${base}/users/me`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${key}` },
    }, 15000);
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, latencyMs, status: res.status, error: txt.slice(0, 200) };
    }
    const data = (await res.json()) as { data?: { id?: string; username?: string; plan?: string } };
    return { ok: true, latencyMs, status: 200, detail: `user=${data.data?.username || data.data?.id || "?"} · plan=${data.data?.plan || "?"}` };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "unknown" };
  }
}

export async function GET(req: NextRequest) {
  const probe = req.nextUrl.searchParams.get("probe") === "1";

  const integrations: IntegrationStatus[] = [
    {
      name: "anthropic",
      envVar: "ANTHROPIC_API_KEY",
      configured: !!(process.env.ANTHROPIC_API_KEY || "").trim(),
      keyPreview: maskKey(process.env.ANTHROPIC_API_KEY || ""),
    },
    {
      name: "tavily",
      envVar: "TAVILY_API_KEY",
      configured: !!(process.env.TAVILY_API_KEY || "").trim(),
      keyPreview: maskKey(process.env.TAVILY_API_KEY || ""),
    },
    {
      name: "coresignal",
      envVar: "CORESIGNAL_API_KEY",
      configured: !!(process.env.CORESIGNAL_API_KEY || "").trim(),
      keyPreview: maskKey(process.env.CORESIGNAL_API_KEY || ""),
      baseUrl: (process.env.CORESIGNAL_BASE_URL || "https://api.coresignal.com/cdapi/v2"),
    },
    {
      name: "apollo",
      envVar: "APOLLO_API_KEY",
      configured: !!(process.env.APOLLO_API_KEY || "").trim(),
      keyPreview: maskKey(process.env.APOLLO_API_KEY || ""),
    },
    {
      name: "apify",
      envVar: "APIFY_API_KEY",
      configured: !!(process.env.APIFY_API_KEY || "").trim(),
      keyPreview: maskKey(process.env.APIFY_API_KEY || ""),
      baseUrl: (process.env.APIFY_BASE_URL || "https://api.apify.com/v2"),
    },
  ];

  if (probe) {
    const [a, t, c, ap, apf] = await Promise.all([probeAnthropic(), probeTavily(), probeCoreSignal(), probeApollo(), probeApify()]);
    integrations[0].probe = a;
    integrations[1].probe = t;
    integrations[2].probe = c;
    integrations[3].probe = ap;
    integrations[4].probe = apf;
  }

  return NextResponse.json({
    integrations,
    probedAt: probe ? new Date().toISOString() : null,
    nodeEnv: process.env.NODE_ENV || "unknown",
  });
}
