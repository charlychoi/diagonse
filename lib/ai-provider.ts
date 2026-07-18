/**
 * AI provider selection.
 *
 * Policy (per product requirement):
 *  - PUBLIC version → uses the public AI provider (Anthropic Claude) when
 *    ANTHROPIC_API_KEY is set. This is what real/public users get.
 *  - INTERNAL testing only → xAI Grok, OpenAI GPT, or Google Gemini. These run
 *    ONLY when AI_MODE="internal" AND a matching key is set — never for
 *    public users. Pick which one with AI_PROVIDER=xai|openai|gemini, or
 *    leave unset to use whichever internal key is present (xai → openai →
 *    gemini priority).
 *  - If no usable key → provider "none" (rule-based fallback with honest note).
 *
 * This guarantees the expensive internal-testing keys are never exercised by
 * public traffic, while the public build still runs a full AI analysis.
 */

import { callAnthropicApi, type AiApiResult } from "./anthropic-api-client";
import { callXaiApi } from "./xai-api-client";
import { callOpenAiApi } from "./openai-api-client";
import { callGeminiApi } from "./gemini-api-client";

export type AiMode = "internal" | "public" | "none";

export type AiConfig = {
  mode: AiMode;
  provider: "xai" | "openai" | "gemini" | "anthropic" | "none";
  label: string;
};

const INTERNAL_PROVIDERS = [
  { provider: "xai" as const, name: "Grok", keyEnv: "XAI_API_KEY", modelEnv: "XAI_MODEL", defaultModel: "grok-4.5" },
  { provider: "openai" as const, name: "GPT", keyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-5" },
  { provider: "gemini" as const, name: "Gemini", keyEnv: "GEMINI_API_KEY", modelEnv: "GEMINI_MODEL", defaultModel: "gemini-2.5-pro" },
];

export function resolveAiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const internal = (env.AI_MODE || "").toLowerCase() === "internal";
  if (internal) {
    const preferred = (env.AI_PROVIDER || "").toLowerCase();
    const candidates = preferred
      ? INTERNAL_PROVIDERS.filter((p) => p.provider === preferred)
      : INTERNAL_PROVIDERS;
    const match = candidates.find((p) => env[p.keyEnv]);
    if (match) {
      const model = env[match.modelEnv] || match.defaultModel;
      return { mode: "internal", provider: match.provider, label: `${match.name} (${model}) · 내부 테스트` };
    }
  }
  if (env.ANTHROPIC_API_KEY) {
    return { mode: "public", provider: "anthropic", label: `Claude (${env.ANTHROPIC_MODEL || "claude-sonnet-4-5"}) · 공개` };
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
  throw new Error("사용 가능한 AI 프로바이더가 없습니다. 공개 버전은 ANTHROPIC_API_KEY, 내부 테스트는 AI_MODE=internal + XAI_API_KEY/OPENAI_API_KEY/GEMINI_API_KEY 중 하나가 필요합니다.");
}
