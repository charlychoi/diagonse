import type { ParsedSiteSignals } from "./crawl";
import type {
  AdReadinessReport,
  AiPrecheckReport,
  ConversionDiagnosisReport,
  DiagnosisInput,
  HeroDiagnosisReport,
  ServicePageDiagnosis,
} from "./types";
import { callAi, resolveAiConfig } from "./ai-provider";

type Context = {
  hero: HeroDiagnosisReport;
  conversion: ConversionDiagnosisReport;
  adReadiness: AdReadinessReport;
  servicePages: ServicePageDiagnosis;
};

type AiPayload = Omit<AiPrecheckReport, "enabled" | "provider" | "model" | "usedWebSearch" | "citations" | "error">;

const EMPTY: AiPayload = {
  summary: "AI 프로바이더 키가 없어 규칙 기반 진단만 실행했습니다.",
  priorities: [],
  messaging: null,
  competitorCandidates: [],
  googlePresence: null,
};

function parseJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalize(raw: Record<string, unknown>): AiPayload {
  const priorities = (Array.isArray(raw.priorities) ? raw.priorities : []).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const reason = typeof row.reason === "string" ? row.reason.trim() : "";
    const action = typeof row.action === "string" ? row.action.trim() : "";
    if (!title || !reason || !action) return [];
    const impact: "high" | "medium" | "low" = row.impact === "low" || row.impact === "medium" ? row.impact : "high";
    return [{ title, reason, action, impact }];
  }).slice(0, 5);

  const competitorCandidates = (Array.isArray(raw.competitorCandidates) ? raw.competitorCandidates : []).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const url = cleanUrl(row.url);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!url || !name) return [];
    const confidence: "high" | "medium" | "low" = row.confidence === "low" || row.confidence === "medium" ? row.confidence : "high";
    return [{
      name,
      url,
      reason: typeof row.reason === "string" ? row.reason.trim() : "동일 시장의 공개 홈페이지 후보",
      confidence,
    }];
  }).slice(0, 3);

  const msg = raw.messaging && typeof raw.messaging === "object" ? raw.messaging as Record<string, unknown> : null;
  const messaging = msg && typeof msg.headline === "string" && typeof msg.subcopy === "string" && typeof msg.primaryCta === "string"
    ? { headline: msg.headline.trim(), subcopy: msg.subcopy.trim(), primaryCta: msg.primaryCta.trim() }
    : null;

  const gp = raw.googlePresence && typeof raw.googlePresence === "object" ? raw.googlePresence as Record<string, unknown> : null;
  const gpStatus = typeof gp?.status === "string" && ["present", "absent", "unclear"].includes(gp.status) ? gp.status as "present" | "absent" | "unclear" : null;
  const googlePresence = gpStatus
    ? {
        status: gpStatus,
        detail: typeof gp?.detail === "string" ? gp.detail.trim() : "",
        guidance: typeof gp?.guidance === "string" ? gp.guidance.trim() : "",
      }
    : null;

  return {
    summary: typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim() : "AI 심층 진단을 완료했습니다.",
    priorities,
    messaging,
    competitorCandidates,
    googlePresence,
  };
}

function buildPrompt(signals: ParsedSiteSignals, input: DiagnosisInput, context: Context): string {
  return `당신은 한국 기업의 광고 집행 전 온라인 마케팅 사전진단 전문가입니다. 반드시 웹 검색을 사용해 경쟁사 후보를 직접 확인하고, 제공된 홈페이지 표면 진단과 함께 종합하십시오.

대상 회사: ${input.company || signals.hostname}
홈페이지: ${signals.url}
산업: ${input.industry || "미입력"}
핵심 키워드: ${(input.keywords || []).join(", ") || "본문에서 추론"}
첫 화면 점수: ${context.hero.score}/100
전환 점수: ${context.conversion.score}/100
광고 준비도: ${context.adReadiness.score}/100 (${context.adReadiness.level})
서비스 페이지: ${context.servicePages.summary}
현재 title: ${signals.title || "없음"}
현재 description: ${signals.description || "없음"}
현재 H1: ${signals.h1s.join(" | ") || "없음"}
공개 본문 발췌: ${signals.bodyText.slice(0, 6000)}

요구사항:
1. 검색을 통해 같은 산업·서비스·지역에서 실제로 경쟁할 가능성이 높은 기업 홈페이지를 최대 3곳 찾으십시오. 검색에서 확인된 공식 HTTPS 홈페이지만 사용하고 디렉터리·뉴스·SNS는 제외하십시오.
2. 경쟁사 선정 근거를 짧게 설명하고 불확실하면 confidence를 낮추십시오. 대상 회사 자체는 제외하십시오.
3. 광고 전 가장 중요한 개선 우선순위와 바로 적용 가능한 첫 화면 문구를 제안하십시오.
4. 확인되지 않은 매출·성과·평판을 단정하지 말고 공개 웹 표면만 평가하십시오.
5. 아래 JSON 형식만 출력하십시오. 마크다운 코드펜스는 쓰지 마십시오.
{
  "summary": "두세 문장의 종합 판단",
  "priorities": [{"title":"", "reason":"", "action":"", "impact":"high|medium|low"}],
  "messaging": {"headline":"", "subcopy":"", "primaryCta":""},
  "competitorCandidates": [{"name":"", "url":"https://...", "reason":"", "confidence":"high|medium|low"}]
}`;
}

function buildConcisePrompt(signals: ParsedSiteSignals, input: DiagnosisInput, context: Context): string {
  return `한국 온라인 마케팅 사전진단을 수행하세요. 웹 검색으로 실제 경쟁사 공식 홈페이지를 확인해야 합니다.
회사=${input.company || signals.hostname}; 홈페이지=${signals.url}; 업종=${input.industry || "미입력"}; 키워드=${(input.keywords || []).join(", ") || "미입력"}; title=${signals.title || "없음"}; H1=${signals.h1s.join(" | ") || "없음"}; 첫화면=${context.hero.score}; 전환=${context.conversion.score}; 광고준비=${context.adReadiness.score}.
같은 서비스·고객·지역의 경쟁사 공식 HTTPS 홈페이지를 최대 3개 검색하세요. 또한 구글에서 회사명을 실제로 검색해 우측 지식/지도 패널(구글 비즈니스 프로필)이 노출되는지 확인하세요. 대상 회사, 뉴스, 디렉터리, SNS는 제외하세요. 확인되지 않은 성과는 단정하지 마세요.
다른 설명 없이 아래 구조의 JSON만 출력하세요:
{"summary":"종합 판단","priorities":[{"title":"","reason":"","action":"","impact":"high|medium|low"}],"messaging":{"headline":"","subcopy":"","primaryCta":""},"competitorCandidates":[{"name":"","url":"https://...","reason":"","confidence":"high|medium|low"}],"googlePresence":{"status":"present|absent|unclear","detail":"구글 검색에서 확인한 지도/지식 패널 상태","guidance":"상태에 맞는 구체적 다음 조치"}}`;
}

function buildCompetitorPrompt(signals: ParsedSiteSignals, input: DiagnosisInput): string {
  return `웹 검색을 사용해 ${input.company || signals.hostname}(${signals.url})와 같은 ${input.industry || (input.keywords || []).join(", ") || "서비스"} 경쟁사 공식 HTTPS 홈페이지를 최대 3개 찾으세요. 대상 회사, 뉴스, 디렉터리, SNS는 제외하세요. 설명 없이 JSON만 출력하세요: {"summary":"경쟁사 검색 완료","priorities":[],"messaging":null,"competitorCandidates":[{"name":"","url":"https://...","reason":"선정 근거","confidence":"high|medium|low"}]}`;
}

function buildStrategyPrompt(signals: ParsedSiteSignals, input: DiagnosisInput, context: Context): string {
  return `웹 검색이나 다른 도구를 사용하지 말고 제공된 진단값만 분석하세요. 회사=${input.company || signals.hostname}; 업종=${input.industry || "미입력"}; 키워드=${(input.keywords || []).join(", ") || "미입력"}; title=${signals.title || "없음"}; description=${signals.description || "없음"}; H1=${signals.h1s.join(" | ") || "없음"}; 첫화면=${context.hero.score}; 전환=${context.conversion.score}; 광고준비=${context.adReadiness.score}. 광고 전 개선 우선순위와 첫 화면 문구를 제안하세요. 설명 없이 JSON만 출력하세요: {"summary":"종합 판단","priorities":[{"title":"","reason":"","action":"","impact":"high|medium|low"}],"messaging":{"headline":"","subcopy":"","primaryCta":""},"competitorCandidates":[]}`;
}

export async function evaluateAiPrecheck(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
  context: Context,
  options: { fetchImpl?: typeof fetch; apiKey?: string } = {},
): Promise<AiPrecheckReport> {
  const config = resolveAiConfig();
  if (config.provider === "none") {
    return { enabled: false, provider: "none", model: null, usedWebSearch: false, citations: [], ...EMPTY };
  }
  try {
    const raw = await callAi(buildConcisePrompt(signals, input, context), { ...options, config });
    const parsed = normalize(parseJson(raw.output));
    if (!parsed.competitorCandidates.length) {
      const competitorRaw = await callAi(buildCompetitorPrompt(signals, input), { ...options, config });
      parsed.competitorCandidates = normalize(parseJson(competitorRaw.output)).competitorCandidates;
      raw.citations.push(...competitorRaw.citations);
    }
    const citations = [...new Set([...raw.citations, ...parsed.competitorCandidates.map((item) => item.url)])];
    return { enabled: true, provider: raw.provider, model: raw.model, usedWebSearch: true, citations, ...parsed };
  } catch (error) {
    return {
      enabled: false,
      provider: "none",
      model: null,
      usedWebSearch: false,
      citations: [],
      ...EMPTY,
      error: error instanceof Error ? error.message : "로컬 AI 심층 진단 중 오류가 발생했습니다.",
    };
  }
}
