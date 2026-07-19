/**
 * Internal-testing AI transport: Google Gemini via the Generative Language API.
 * Same shape as lib/xai-api-client.ts / lib/openai-api-client.ts — gated
 * Clone owners opt in with their own key in the server environment.
 */

export type GeminiApiResult = {
  provider: "gemini";
  model: string;
  output: string;
  citations: string[];
};

function extractText(raw: Record<string, unknown>): string {
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
  const pieces: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const content = (candidate as Record<string, unknown>).content;
    const parts = content && typeof content === "object" ? (content as Record<string, unknown>).parts : undefined;
    for (const part of Array.isArray(parts) ? parts : []) {
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
      if (typeof row.uri === "string" && /^https:\/\//i.test(row.uri)) found.add(row.uri);
      for (const nested of Object.values(row)) walk(nested);
    }
  };
  walk(raw.candidates);
  return [...found].slice(0, 12);
}

export async function callGeminiApi(
  prompt: string,
  options: { fetchImpl?: typeof fetch; apiKey?: string; model?: string; timeoutMs?: number; webSearch?: boolean } = {},
): Promise<GeminiApiResult> {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. 프로젝트의 .env.local에 키를 설정해 주세요.");
  const model = options.model || process.env.GEMINI_MODEL || "gemini-2.5-pro";
  const response = await (options.fetchImpl || fetch)(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: options.webSearch === false ? [] : [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 5000 },
      }),
      signal: AbortSignal.timeout(options.timeoutMs || 90_000),
    },
  );
  const raw = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const nested = raw.error && typeof raw.error === "object" ? (raw.error as Record<string, unknown>).message : undefined;
    throw new Error(typeof nested === "string" ? nested : `Gemini API 오류 (${response.status})`);
  }
  const output = extractText(raw).trim();
  if (!output) throw new Error("Gemini API 응답에 분석 텍스트가 없습니다.");
  return { provider: "gemini", model, output, citations: collectCitations(raw) };
}
