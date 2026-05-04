export type Provider = "anthropic" | "mock";

export interface LlmInput {
  system: string;
  user: string;
  maxTokens?: number;
  jsonOnly?: boolean;
  mockOutput: string;
  mcpServers?: McpServer[];
  cacheSystem?: boolean;
  model?: "sonnet" | "haiku" | "opus";
}

export interface LlmOutput {
  text: string;
  provider: Provider;
  model: string;
  isLive: boolean;
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

interface McpServer {
  type: "url";
  url: string;
  name: string;
  authorization_token?: string;
}

const MODEL_IDS: Record<NonNullable<LlmInput["model"]>, string> = {
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
  opus: "claude-opus-4-7",
};
const DEFAULT_MODEL: NonNullable<LlmInput["model"]> = "sonnet";

function envKey(name: string): string {
  const v = process.env[name];
  return v ? v.trim() : "";
}

export function detectProvider(): Provider {
  if (envKey("ANTHROPIC_API_KEY")) return "anthropic";
  return "mock";
}

export function isLlmLive(): boolean {
  return detectProvider() === "anthropic";
}

export async function llm(input: LlmInput): Promise<LlmOutput> {
  const provider = detectProvider();
  const maxTokens = input.maxTokens ?? 1500;
  const userPrompt = input.jsonOnly
    ? `${input.user}\n\nReturn ONLY valid JSON. No prose, no markdown fences.`
    : input.user;

  if (provider === "mock") {
    return {
      text: input.mockOutput,
      provider: "mock",
      model: "mock",
      isLive: false,
      inputTokens: 0,
      outputTokens: estimateTokens(input.mockOutput),
    };
  }

  try {
    return await callAnthropic(input, userPrompt, maxTokens);
  } catch (err) {
    return {
      text: input.mockOutput,
      provider: "anthropic",
      model: MODEL_IDS[input.model || DEFAULT_MODEL],
      isLive: false,
      inputTokens: 0,
      outputTokens: 0,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

async function callAnthropic(input: LlmInput, userPrompt: string, maxTokens: number): Promise<LlmOutput> {
  const modelKey = input.model || DEFAULT_MODEL;
  const modelId = MODEL_IDS[modelKey];

  const systemBlock: Array<Record<string, unknown>> = [{ type: "text", text: input.system }];
  if (input.cacheSystem && input.system.length > 1024) {
    systemBlock[0].cache_control = { type: "ephemeral" };
  }

  const body: Record<string, unknown> = {
    model: modelId,
    max_tokens: maxTokens,
    system: systemBlock,
    messages: [{ role: "user", content: userPrompt }],
  };
  if (input.mcpServers && input.mcpServers.length > 0) {
    body.mcp_servers = input.mcpServers;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": envKey("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "mcp-client-2025-04-04,prompt-caching-2024-07-31",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  type Msg = {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
    model?: string;
  };
  const data = (await res.json()) as Msg;
  const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text || "").join("\n\n");
  const cacheRead = data.usage?.cache_read_input_tokens ?? 0;
  const cacheCreate = data.usage?.cache_creation_input_tokens ?? 0;
  const baseIn = data.usage?.input_tokens ?? 0;
  return {
    text,
    provider: "anthropic",
    model: data.model || modelId,
    isLive: true,
    inputTokens: baseIn + cacheRead + cacheCreate,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export function extractJson<T>(text: string, fallback: T): T {
  if (!text) return fallback;
  const stripped = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return fallback;
  try {
    return JSON.parse(stripped.slice(start, end + 1)) as T;
  } catch {
    return fallback;
  }
}
