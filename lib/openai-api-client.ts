/**
 * Internal-testing AI transport: OpenAI (GPT) via the Responses API.
 * Same shape as lib/xai-api-client.ts — gated behind AI_MODE=internal in
 * lib/ai-provider.ts, never used for public traffic.
 */

export type OpenAiApiResult = {
  provider: "openai";
  model: string;
  output: string;
  citations: string[];
};

function extractText(raw: Record<string, unknown>): string {
  if (typeof raw.output_text === "string") return raw.output_text;
  const pieces: string[] = [];
  for (const item of Array.isArray(raw.output) ? raw.output : []) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    for (const part of Array.isArray(content) ? content : []) {
      if (!part || typeof part !== "object") continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string") pieces.push(text);
    }
  }
  return pieces.join("\n");
}

function collectCitations(raw: Record<string, unknown>): string[] {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === "string" && /^https:\/\//i.test(value)) found.add(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      const row = value as Record<string, unknown>;
      if (typeof row.url === "string" && /^https:\/\//i.test(row.url)) found.add(row.url);
      for (const nested of Object.values(row)) walk(nested);
    }
  };
  walk(raw.output);
  return [...found].slice(0, 12);
}

export async function callOpenAiApi(
  prompt: string,
  options: { fetchImpl?: typeof fetch; apiKey?: string; model?: string; timeoutMs?: number; webSearch?: boolean } = {},
): Promise<OpenAiApiResult> {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. 프로젝트의 .env.local에 키를 설정해 주세요.");
  const model = options.model || process.env.OPENAI_MODEL || "gpt-5";
  const response = await (options.fetchImpl || fetch)("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      tools: options.webSearch === false ? [] : [{ type: "web_search_preview" }],
      max_output_tokens: 5000,
      store: false,
    }),
    signal: AbortSignal.timeout(options.timeoutMs || 90_000),
  });
  const raw = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const nested = raw.error && typeof raw.error === "object" ? (raw.error as Record<string, unknown>).message : undefined;
    throw new Error(typeof nested === "string" ? nested : `OpenAI API 오류 (${response.status})`);
  }
  const output = extractText(raw).trim();
  if (!output) throw new Error("OpenAI API 응답에 분석 텍스트가 없습니다.");
  return { provider: "openai", model, output, citations: collectCitations(raw) };
}
