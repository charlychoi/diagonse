/**
 * AI provider selection.
 *
 * Policy:
 *  - LOCAL OAuth mode reuses a signed-in Grok or Codex CLI on this Mac only.
 *  - API mode lets each clone owner supply their own Anthropic, OpenAI,
 *    Gemini, or xAI key on the server.
 *  - If no usable key → provider "none" (rule-based fallback with honest note).
 */

import { callAnthropicApi, type AiApiResult } from "./anthropic-api-client";
import { callXaiApi } from "./xai-api-client";
import { callOpenAiApi } from "./openai-api-client";
import { callGeminiApi } from "./gemini-api-client";

export type AiMode = "local" | "api" | "none";

export type AiConfig = {
  mode: AiMode;
  provider: "xai" | "openai" | "gemini" | "anthropic" | "codex_cli" | "grok_cli" | "none";
  label: string;
};

const API_PROVIDERS = [
  { provider: "anthropic" as const, name: "Claude", keyEnv: "ANTHROPIC_API_KEY", modelEnv: "ANTHROPIC_MODEL", defaultModel: "claude-sonnet-4-5" },
  { provider: "openai" as const, name: "GPT", keyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-5.6" },
  { provider: "gemini" as const, name: "Gemini", keyEnv: "GEMINI_API_KEY", modelEnv: "GEMINI_MODEL", defaultModel: "gemini-2.5-pro" },
  { provider: "xai" as const, name: "Grok", keyEnv: "XAI_API_KEY", modelEnv: "XAI_MODEL", defaultModel: "grok-4.5" },
];

export function resolveAiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const mode = (env.AI_MODE || "").toLowerCase();
  const preferred = (env.AI_PROVIDER || "").toLowerCase();

  if (mode === "local" || mode === "local-oauth" || mode === "oauth") {
    if (["codex", "chatgpt", "gpt", "openai"].includes(preferred)) {
      const model = env.CODEX_MODEL || "gpt-5.6";
      return { mode: "local", provider: "codex_cli", label: `Codex OAuth (${model}) · 이 Mac 전용` };
    }
    const model = env.GROK_MODEL || "grok-4.5";
    return { mode: "local", provider: "grok_cli", label: `Grok OAuth (${model}) · 이 Mac 전용` };
  }

  const aliases: Record<string, string> = { claude: "anthropic", chatgpt: "openai", gpt: "openai", grok: "xai" };
  const normalized = aliases[preferred] || preferred;
  const candidates = normalized
    ? API_PROVIDERS.filter((p) => p.provider === normalized)
    : API_PROVIDERS;
  const match = candidates.find((p) => env[p.keyEnv]);
  if (match) {
    const model = env[match.modelEnv] || match.defaultModel;
    return { mode: "api", provider: match.provider, label: `${match.name} API (${model}) · 사용자 키` };
  }
  return { mode: "none", provider: "none", label: "규칙 기반(폴백)" };
}

export function aiEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return resolveAiConfig(env).provider !== "none";
}

/**
 * Unified AI call. Routes to the provider chosen by resolveAiConfig.
 * Throws if provider is "none" — callers should guard with aiEnabled().
 */
export async function callAi(
  prompt: string,
  options: { webSearch?: boolean; fetchImpl?: typeof fetch; timeoutMs?: number; config?: AiConfig } = {},
): Promise<AiApiResult> {
  const config = options.config || resolveAiConfig();
  if (config.provider === "codex_cli" || config.provider === "grok_cli") {
    const { callLocalCliAi } = await import("./local-cli-ai");
    return callLocalCliAi(config.provider, prompt, {
      webSearch: options.webSearch,
      timeoutMs: options.timeoutMs,
    });
  }
  if (config.provider === "xai") {
    const r = await callXaiApi(prompt, { webSearch: options.webSearch, fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs });
    return { provider: "xai", model: r.model, output: r.output, citations: r.citations };
  }
  if (config.provider === "openai") {
    const r = await callOpenAiApi(prompt, { webSearch: options.webSearch, fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs });
    return { provider: "openai", model: r.model, output: r.output, citations: r.citations };
  }
  if (config.provider === "gemini") {
    const r = await callGeminiApi(prompt, { webSearch: options.webSearch, fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs });
    return { provider: "gemini", model: r.model, output: r.output, citations: r.citations };
  }
  if (config.provider === "anthropic") {
    return callAnthropicApi(prompt, { webSearch: options.webSearch, fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs });
  }
  throw new Error("사용 가능한 AI가 없습니다. 로컬 OAuth는 AI_MODE=local-oauth와 Grok/Codex 로그인이, API 방식은 사용자의 ANTHROPIC/OPENAI/GEMINI/XAI_API_KEY 중 하나가 필요합니다.");
}
