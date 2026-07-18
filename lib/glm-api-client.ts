/**
 * AI transport: Z.AI GLM (glm-5.2) via the OpenAI-compatible chat completions API.
 * Same shape as lib/xai-api-client.ts / lib/openai-api-client.ts.
 * Selected in lib/ai-provider.ts (AI_PROVIDER=glm or public fallback).
 *
 * Default endpoint: https://api.z.ai/api/paas/v4/chat/completions
 * 중국 본토 키(bigmodel.cn)라면 GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4 로 변경.
 */

export type GlmApiResult = {
  provider: "glm";
  model: string;
  output: string;
  citations: string[];
};

function extractText(raw: Record<string, unknown>): string {
  const choices = Array.isArray(raw.choices) ? raw.choices : [];
  const pieces: string[] = [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as Record<string, unknown>).message;
    if (!message || typeof message !== "object") continue;
    const content = (message as Record<string, unknown>).content;
    if (typeof content === "string") pieces.push(content);
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
  walk(raw.web_search);
  walk(raw.choices);
  return [...found].slice(0, 12);
}

export async function callGlmApi(
  prompt: string,
  options: { fetchImpl?: typeof fetch; apiKey?: string; model?: string; timeoutMs?: number; webSearch?: boolean } = {},
): Promise<GlmApiResult> {
  const apiKey = options.apiKey || process.env.GLM_API_KEY;
  if (!apiKey) throw new Error("GLM_API_KEY가 설정되지 않았습니다. 프로젝트의 .env.local 또는 Vercel 환경변수에 키를 설정해 주세요.");
  const model = options.model || process.env.GLM_MODEL || "glm-5.2";
  const baseUrl = (process.env.GLM_BASE_URL || "https://api.z.ai/api/paas/v4").replace(/\/$/, "");
  const response = await (options.fetchImpl || fetch)(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 5000,
      // 진단 응답은 구조화된 JSON — 딥 추론(thinking)은 지연(90s+ 타임아웃)만 유발하므로 비활성화
      thinking: { type: "disabled" },
      ...(options.webSearch === false
        ? {}
        : {
            tools: [{
              type: "web_search",
              web_search: { enable: true, search_engine: "search_pro_jina", search_result: true, count: 10 },
            }],
          }),
    }),
    signal: AbortSignal.timeout(options.timeoutMs || 90_000),
  });
  const raw = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const nested = raw.error && typeof raw.error === "object" ? (raw.error as Record<string, unknown>).message : undefined;
    throw new Error(typeof nested === "string" ? nested : `GLM API 오류 (${response.status})`);
  }
  const output = extractText(raw).trim();
  if (!output) throw new Error("GLM API 응답에 분석 텍스트가 없습니다.");
  return { provider: "glm", model, output, citations: collectCitations(raw) };
}
