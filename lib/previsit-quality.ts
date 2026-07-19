/**
 * v4.1 사전진단 품질 패스 — AI 능력을 최대로 활용해 신뢰성·이해도를 높인다.
 *
 * 단일 AI 호출로 3가지를 생성한다(비용·지연 최소화):
 *  1) easySummary  — 비전문가(기업 대표)도 이해할 쉬운 용어 요약
 *  2) previsitBrief — 컨설턴트 방문 전 브리핑 팩(페인포인트·미팅 질문)
 *  3) qualityFlags  — 진단 자체의 과대단정·근거부족 자기검증(§20 보완)
 *
 * AI 미사용·실패 시 규칙 기반 폴백으로 항상 결과를 보장한다.
 */
import { aiEnabled, callAi } from "./ai-provider";
import type { DiagnosisResult } from "./types";
import { MARKET_MOTION_LABEL } from "./business-profile-types";

export type PrevisitQualityReport = {
  enabled: boolean;
  source: "ai" | "fallback";
  model: string | null;
  easySummary: {
    headline: string;
    whatWeChecked: string;
    topRisks: { title: string; whyPlain: string; todo: string }[];
    quickWinsPlain: string[];
  };
  previsitBrief: {
    companySnapshot: string;
    channelSnapshot: string[];
    expectedPainPoints: { point: string; evidence: string }[];
    meetingQuestions: string[];
    talkingPoints: string[];
  };
  qualityFlags: { code: string; message: string }[];
  error?: string;
};

type AiCallFn = typeof callAi;

function digest(result: Omit<DiagnosisResult, "markdownReport">): string {
  const p = result.businessProfile;
  const a = result.adaptiveScores;
  const worstChecks = [a.coreReadiness, ...a.journeyScores]
    .flatMap((c) => c.checks.filter((ch) => ch.status === "fail" || ch.status === "warn").map((ch) => `${ch.title}: ${ch.detail}`))
    .slice(0, 14);
  return JSON.stringify({
    company: result.input.company || result.siteTitle,
    url: result.input.url,
    businessModel: {
      primary: MARKET_MOTION_LABEL[p.primaryMarketMotion],
      secondary: p.secondaryMarketMotions.map((m) => MARKET_MOTION_LABEL[m]),
      confidence: p.confidenceLabel,
      evidence: p.evidence.slice(0, 4).map((e) => e.claim),
    },
    journeys: p.journeys.map((j) => ({ label: j.label, priority: j.priority, objective: j.objective })),
    scores: {
      core: a.coreReadiness.score,
      journeys: a.journeyScores.map((j) => ({ label: j.journeyLabel, score: j.score, naCount: j.naCount })),
      provisional: a.provisional,
    },
    weakSignals: worstChecks,
    aiPriorities: result.aiPrecheck.priorities.slice(0, 5).map((x) => x.title),
    keywords: result.keywordStrategy.tier1.map((t) => t.keyword),
    quickWins: result.quickWins.slice(0, 4).map((q) => q.title),
  });
}

function buildPrompt(result: Omit<DiagnosisResult, "markdownReport">): string {
  return [
    "당신은 사회적기업 대상 AX(AI 전환) 마케팅 컨설턴트의 수석 보좌역입니다.",
    "아래 사전진단 데이터(JSON)만 근거로 사용하고, 데이터에 없는 사실을 만들지 마세요.",
    "전문용어(SEO, CTA, 전환율, 메타태그 등)는 60대 기업 대표도 이해할 일상 언어로 풀어 쓰세요.",
    "잘못되었거나 과장된 진단이 보이면 qualityFlags에 지적하세요(예: 근거 없는 단정, 유형과 안 맞는 권고).",
    "",
    "진단 데이터:",
    digest(result),
    "",
    "다음 JSON만 출력하세요(코드블록·설명 금지):",
    '{"easySummary":{"headline":"한 문장 핵심 결론(쉬운 말)","whatWeChecked":"무엇을 어떻게 진단했는지 2~3문장(쉬운 말)","topRisks":[{"title":"위험 제목(쉬운 말)","whyPlain":"왜 문제인지 비유·일상어 설명 1~2문장","todo":"이번 주에 할 수 있는 첫 조치 1문장"}],"quickWinsPlain":["바로 효과 보는 조치(쉬운 말) 3~4개"]},',
    '"previsitBrief":{"companySnapshot":"기업 한 단락 요약(모델·고객·강점·약점)","channelSnapshot":["채널별 현황 한 줄씩 3~5개"],"expectedPainPoints":[{"point":"예상 페인포인트","evidence":"진단 데이터의 근거"}],"meetingQuestions":["방문 미팅에서 확인할 질문 8~10개 — 지원사업 의존도, 매출 구성, 운영 인력, 콘텐츠 담당, 실제 문의 경로 포함"],"talkingPoints":["미팅에서 컨설턴트가 강조할 포인트 3~4개"]},',
    '"qualityFlags":[{"code":"OVERCLAIM|WEAK_EVIDENCE|TYPE_MISMATCH|OK","message":"설명"}]}',
    "",
    "topRisks는 3~5개. 점수가 낮은 항목·여정 순으로. 모든 문장은 한국어 존댓말.",
  ].join("\n");
}

function parse(raw: string): Omit<PrevisitQualityReport, "enabled" | "source" | "model"> | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const d = JSON.parse(m[0]) as Record<string, never>;
    const es = (d.easySummary || {}) as Record<string, never>;
    const pb = (d.previsitBrief || {}) as Record<string, never>;
    const strArr = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []).slice(0, n) as string[];
    return {
      easySummary: {
        headline: String(es.headline || ""),
        whatWeChecked: String(es.whatWeChecked || ""),
        topRisks: (Array.isArray(es.topRisks) ? es.topRisks : []).slice(0, 5).map((r) => ({
          title: String((r as Record<string, unknown>).title || ""),
          whyPlain: String((r as Record<string, unknown>).whyPlain || ""),
          todo: String((r as Record<string, unknown>).todo || ""),
        })).filter((r) => r.title),
        quickWinsPlain: strArr(es.quickWinsPlain, 4),
      },
      previsitBrief: {
        companySnapshot: String(pb.companySnapshot || ""),
        channelSnapshot: strArr(pb.channelSnapshot, 5),
        expectedPainPoints: (Array.isArray(pb.expectedPainPoints) ? pb.expectedPainPoints : []).slice(0, 6).map((r) => ({
          point: String((r as Record<string, unknown>).point || ""),
          evidence: String((r as Record<string, unknown>).evidence || ""),
        })).filter((r) => r.point),
        meetingQuestions: strArr(pb.meetingQuestions, 10),
        talkingPoints: strArr(pb.talkingPoints, 4),
      },
      qualityFlags: (Array.isArray(d.qualityFlags) ? d.qualityFlags : []).slice(0, 6).map((f) => ({
        code: String((f as Record<string, unknown>).code || "OK"),
        message: String((f as Record<string, unknown>).message || ""),
      })).filter((f) => f.message),
    };
  } catch { return null; }
}

function fallback(result: Omit<DiagnosisResult, "markdownReport">): PrevisitQualityReport {
  const a = result.adaptiveScores;
  const fails = [a.coreReadiness, ...a.journeyScores]
    .flatMap((c) => c.checks.filter((ch) => ch.status === "fail"))
    .slice(0, 4);
  return {
    enabled: false,
    source: "fallback",
    model: null,
    easySummary: {
      headline: "홈페이지의 공개 정보만으로 진단한 결과이며, AI 요약 없이 규칙 기반으로 정리했습니다.",
      whatWeChecked: "홈페이지가 검색에서 잘 발견되는지, 방문한 고객이 다음 행동으로 이어질 수 있는지, 비즈니스 유형에 맞는 준비가 되어 있는지를 점검했습니다.",
      topRisks: fails.map((f) => ({ title: f.title, whyPlain: f.detail, todo: f.action })),
      quickWinsPlain: result.quickWins.slice(0, 4).map((q) => q.title),
    },
    previsitBrief: {
      companySnapshot: `${result.input.company || result.siteTitle || "대상 기업"} — ${MARKET_MOTION_LABEL[result.businessProfile.primaryMarketMotion]} 프로필로 진단되었습니다(신뢰도 ${result.businessProfile.confidenceLabel}).`,
      channelSnapshot: [`홈페이지: ${result.input.url}`, `크롤 페이지 ${result.crawledPages.length}개 분석`],
      expectedPainPoints: fails.map((f) => ({ point: f.title, evidence: f.detail })),
      meetingQuestions: [
        "현재 매출 구성(공공/민간/지원사업)은 어떻게 되나요?",
        "홈페이지·콘텐츠는 누가 관리하고 있나요?",
        "문의·상담은 주로 어떤 경로로 들어오나요?",
        "지금까지 온라인 광고를 집행해 본 경험이 있나요?",
        "가장 알리고 싶은 핵심 서비스는 무엇인가요?",
        "경쟁사 또는 비슷한 기관 중 참고하는 곳이 있나요?",
      ],
      talkingPoints: ["진단은 공개 화면 기준이므로 내부 데이터로 함께 검증 필요"],
    },
    qualityFlags: [{ code: "OK", message: "AI 품질 패스가 실행되지 않아 규칙 기반 요약으로 대체했습니다." }],
  };
}

export async function runPrevisitQualityPass(
  result: Omit<DiagnosisResult, "markdownReport">,
  options: { aiCall?: AiCallFn; aiAvailable?: boolean; timeoutMs?: number } = {},
): Promise<PrevisitQualityReport> {
  const available = options.aiAvailable ?? aiEnabled();
  if (!available) return fallback(result);
  try {
    const call = options.aiCall || callAi;
    const raw = await call(buildPrompt(result), { webSearch: false, timeoutMs: options.timeoutMs ?? 75_000 });
    const parsed = parse(raw.output);
    if (!parsed || !parsed.easySummary.headline || !parsed.easySummary.topRisks.length) {
      return { ...fallback(result), error: "AI 응답 형식 오류 — 규칙 기반으로 대체" };
    }
    return { enabled: true, source: "ai", model: raw.model, ...parsed };
  } catch (error) {
    return { ...fallback(result), error: error instanceof Error ? error.message : "품질 패스 실패" };
  }
}
