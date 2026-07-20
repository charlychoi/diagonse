export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { resolveAiConfig, aiEnabled, callAi } from "../../../lib/ai-provider";
import { isDeploymentExpired, expiryDateLabel, expiryMessage } from "../../../lib/deployment-expiry";
import { getServiceNotice } from "../../../lib/service-notice";

/**
 * GET /api/health          → 서비스 상태 + 현재 AI 프로바이더 라벨
 * GET /api/health?ai=1     → AI 셀프테스트(실제 1회 호출, web search 미사용)
 */
export async function GET(request: Request) {
  const config = resolveAiConfig();
  const expired = isDeploymentExpired();
  const base = {
    ok: true,
    service: "diagonse",
    mode: "auto-agent-api",
    ai: { enabled: aiEnabled(), provider: config.provider, label: config.label },
    time: new Date().toISOString(),
    expiry: {
      expired,
      expiresAt: expiryDateLabel(),
      message: expired ? expiryMessage() : null,
    },
    notice: getServiceNotice(),
  };
  const url = new URL(request.url);
  const aiParam = url.searchParams.get("ai");
  if (aiParam !== "1" && aiParam !== "2") return Response.json(base);
  const useSearch = aiParam === "2";
  if (!aiEnabled()) return Response.json({ ...base, aiTest: { ok: false, error: "no provider" } });
  try {
    const started = Date.now();
    const r = await callAi(
      useSearch
        ? 'Search the web for the current year and reply with JSON only: {"year":"<YYYY>"}'
        : 'JSON one-liner only: {"ping":"pong"}',
      { webSearch: useSearch, timeoutMs: 45_000 },
    );
    return Response.json({
      ...base,
      aiTest: { ok: true, model: r.model, ms: Date.now() - started, sample: r.output.slice(0, 80) },
    });
  } catch (error) {
    return Response.json({
      ...base,
      aiTest: { ok: false, error: error instanceof Error ? error.message : String(error) },
    });
  }
}
