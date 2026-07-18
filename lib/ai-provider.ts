/**
 * AI provider selection.
 *
 * Policy (per product requirement):
 *  - PUBLIC version → uses the public AI provider (Anthropic Claude) when
 *    ANTHROPIC_API_KEY is set. This is what real/public users get.
 *  - INTERNAL testing only → Grok 4.5 (xAI). Grok runs ONLY when
 *    AI_MODE="internal" AND XAI_API_KEY is set — never for public users.
 *  - If no usable key → provider "none" (rule-based fallback with honest note).
 *
 * This guarantees the expensive Grok key is never exercised by public traffic,
 * while the public build still runs a full AI analysis.
 */

import { callAnthropicApi, type AiApiResult } from "./anthropic-api-client";
import { callXaiApi } from "./xai-api-client";

export type AiMode = "internal" | "public" | "none";

export type AiConfig = {
  mode: AiMode;
  provider: "xai" | "anthropic" | "none";
  label: string;
};

export function resolveAiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  const internal = (env.AI_MODE || "").toLowerCase() === "internal";
  if (internal && env.XAI_API_KEY) {
    return { mode: "internal", provider: "xai", label: `Grok (${env.XAI_MODEL || "grok-4.5"}) · 내부 테스트` };
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
  if (config.provider === "anthropic") {
    return callAnthropicApi(prompt, { webSearch: options.webSearch, fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs });
  }
  throw new Error("사용 가능한 AI 프로바이더가 없습니다. 공개 버전은 ANTHROPIC_API_KEY, 내부 테스트는 AI_MODE=internal + XAI_API_KEY가 필요합니다.");
}
