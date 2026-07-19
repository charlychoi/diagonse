/**
 * Anthropic Claude API transport with web search.
 */

export type AiApiResult = {
  provider: "anthropic" | "xai" | "openai" | "gemini";
  model: string;
  output: string;
  citations: string[];
};

type Block = {
  type?: string;
  text?: string;
  citations?: Array<{ url?: string }>;
};

function extractText(blocks: Block[]): string {
  return blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();
}

function extractCitations(blocks: Block[]): string[] {
  const found = new Set<string>();
  for (const b of blocks) {
    for (const c of b.citations ?? []) {
      if (typeof c.url === "string" && /^https:\/\//i.test(c.url)) found.add(c.url);
    }
  }
  return [...found].slice(0, 12);
}

export async function callAnthropicApi(
  prompt: string,
  options: { fetchImpl?: typeof fetch; apiKey?: string; model?: string; timeoutMs?: number; webSearch?: boolean } = {},
): Promise<AiApiResult> {
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  const model = options.model || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  const tools =
    options.webSearch === false ? [] : [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];

  const res = await (options.fetchImpl || fetch)("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
      ...(tools.length ? { tools } : {}),
    }),
    signal: AbortSignal.timeout(options.timeoutMs || 90_000),
  });

  const raw = (await res.json()) as { content?: Block[]; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(raw.error?.message || `Anthropic API 오류 (${res.status})`);
  }
  const blocks = Array.isArray(raw.content) ? raw.content : [];
  const output = extractText(blocks);
  if (!output) throw new Error("Anthropic API 응답에 분석 텍스트가 없습니다.");
  return { provider: "anthropic", model, output, citations: extractCitations(blocks) };
}
