/**
 * v4.2 사전진단 품질 패스 — AI 능력을 최대로 활용해 신뢰성·이해도를 높인다.
 *
 * 핵심 원칙: "쉬운 보고서"를 별도로 지어내지 않는다. 이미 완성된
 * 사전진단 상세 보고서(markdownReport) 원문을 AI에게 그대로 주고,
 * 그 내용을 쉬운 말로 요약·정리하게 한다 — 상세 보고서와 요약이
 * 서로 다른 이야기를 하는 문제(핀트 어긋남)를 근본적으로 막는다.
 *
 * 단일 AI 호출로 2가지를 생성한다(비용·지연 최소화):
 *  1) summary        — 상세 보고서를 그대로 쉬운 말로 옮긴 사전진단 요약
 *  2) previsitBrief   — 컨설턴트 방문 전 브리핑 팩(페인포인트·미팅 질문)
 *  + qualityFlags     — 진단 자체의 과대단정·근거부족 자기검증(§20 보완)
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
  summary: {
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

const QUALITY_FLAG_LABEL: Record<string, string> = {
  OVERCLAIM: "과장된 표현 주의",
  WEAK_EVIDENCE: "근거가 약함",
  TYPE_MISMATCH: "비즈니스 유형과 안 맞는 권고",
  OK: "특이사항 없음",
};

export function qualityFlagLabel(code: string): string {
  return QUALITY_FLAG_LABEL[code] || code;
}

/** 상세 보고서 원문에서 AI 요약의 근거로 쓸 앞부분(v4 핵심 섹션)을 추출 */
function reportExcerpt(markdownReport: string, maxChars = 9000): string {
  return markdownReport.slice(0, maxChars);
}

/** 원문 grounding을 보완하는 소량의 정밀 데이터(제목만) — AI가 실제 목록과 다른 항목을 지어내는 것을 방지 */
function anchorFacts(result: Omit<DiagnosisResult, "markdownReport" | "previsitQuality" | "briefMarkdown" | "summaryMarkdown">): string {
  return JSON.stringify({
    company: result.input.company || result.siteTitle,
    businessModel: MARKET_MOTION_LABEL[result.businessProfile.primaryMarketMotion],
    quickWinTitles: result.quickWins.slice(0, 5).map((q) => q.title),
    roadmapTitles: result.roadmap.slice(0, 6).map((r) => r.title),
    aiPriorityTitles: result.aiPrecheck.priorities.slice(0, 5).map((p) => p.title),
  });
}

function buildPrompt(
  markdownReport: string,
  result: Omit<DiagnosisResult, "markdownReport" | "previsitQuality" | "briefMarkdown" | "summaryMarkdown">,
): string {
  return [
    "당신은 사회적기업 대상 AX(AI 전환) 마케팅 컨설턴트의 수석 보좌역입니다.",
    "아래는 이미 완성된 '사전진단 상세 보고서' 원문입니다. 이 보고서에 실제로 적힌 내용만 근거로 사용하세요.",
    "보고서에 없는 사실을 새로 지어내지 말고, 이 보고서를 그대로 쉬운 말로 옮기는 것이 목표입니다.",
    "전문용어(SEO, CTA, 전환율, 메타태그, N/A, 신뢰도, 여정 등)는 60대 기업 대표도 이해할 일상 언어로 풀어 쓰세요.",
    "영어 단어를 한국어 문장에 그대로 섞지 마세요(예: primary, hybrid). B2C·B2B·B2G 같은 굳어진 약어는 괜찮습니다.",
    "보고서 내용이 잘못되었거나 과장되어 보이면 qualityFlags에 지적하세요.",
    "",
    "=== 사전진단 상세 보고서 원문 (발췌) ===",
    reportExcerpt(markdownReport),
    "=== 발췌 끝 ===",
    "",
    "위 보고서와 반드시 일치해야 하는 실제 항목 목록(제목을 지어내지 말고 아래에서만 고르세요):",
    anchorFacts(result),
    "",
    "다음 JSON만 출력하세요(코드블록·설명 금지):",
    '{"summary":{"headline":"보고서의 핵심 결론을 한 문장으로(쉬운 말)","whatWeChecked":"무엇을 어떻게 진단했는지 2~3문장(쉬운 말)","topRisks":[{"title":"보고서에 나온 위험 제목을 쉬운 말로","whyPlain":"보고서 내용을 근거로 왜 문제인지 1~2문장","todo":"보고서의 개선 방향을 바탕으로 이번 주에 할 수 있는 첫 조치 1문장"}],"quickWinsPlain":["위 quickWinTitles 중에서 골라 쉬운 말로 3~4개"]},',
    '"previsitBrief":{"companySnapshot":"보고서 내용 기반 기업 한 단락 요약(모델·고객·강점·약점)","channelSnapshot":["보고서에 나온 채널별 현황 한 줄씩 3~5개"],"expectedPainPoints":[{"point":"보고서에 나온 예상 페인포인트","evidence":"보고서의 해당 근거"}],"meetingQuestions":["방문 미팅에서 확인할 질문 8~10개 — 지원사업 의존도, 매출 구성, 운영 인력, 콘텐츠 담당, 실제 문의 경로 포함"],"talkingPoints":["미팅에서 컨설턴트가 강조할 포인트 3~4개(보고서 근거 기반)"]},',
    '"qualityFlags":[{"code":"OVERCLAIM|WEAK_EVIDENCE|TYPE_MISMATCH|OK","message":"설명"}]}',
    "",
    "topRisks는 보고서에서 상태가 나쁜 항목 순으로 3~5개만. 모든 문장은 한국어 존댓말.",
  ].join("\n");
}

function parse(raw: string): Omit<PrevisitQualityReport, "enabled" | "source" | "model"> | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const d = JSON.parse(m[0]) as Record<string, never>;
    const es = (d.summary || {}) as Record<string, never>;
    const pb = (d.previsitBrief || {}) as Record<string, never>;
    const strArr = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []).slice(0, n) as string[];
    return {
      summary: {
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

function fallback(result: Omit<DiagnosisResult, "markdownReport" | "previsitQuality" | "briefMarkdown" | "summaryMarkdown">): PrevisitQualityReport {
  const a = result.adaptiveScores;
  const fails = [a.coreReadiness, ...a.journeyScores]
    .flatMap((c) => c.checks.filter((ch) => ch.status === "fail"))
    .slice(0, 4);
  return {
    enabled: false,
    source: "fallback",
    model: null,
    summary: {
      headline: "홈페이지의 공개 정보만으로 진단한 결과이며, AI 요약 없이 규칙 기반으로 정리했습니다.",
      whatWeChecked: "홈페이지가 검색에서 잘 발견되는지, 방문한 고객이 다음 행동으로 이어질 수 있는지, 비즈니스 유형에 맞는 준비가 되어 있는지를 점검했습니다.",
      topRisks: fails.map((f) => ({ title: f.title, whyPlain: f.detail, todo: f.action })),
      quickWinsPlain: result.quickWins.slice(0, 4).map((q) => q.title),
    },
    previsitBrief: {
      companySnapshot: `${result.input.company || result.siteTitle || "대상 기업"} — ${MARKET_MOTION_LABEL[result.businessProfile.primaryMarketMotion]} 성격으로 진단되었습니다(판별 확신도 ${result.businessProfile.confidenceLabel === "high" ? "높음" : result.businessProfile.confidenceLabel === "medium" ? "중간" : "낮음"}).`,
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
  markdownReport: string,
  result: Omit<DiagnosisResult, "markdownReport" | "previsitQuality" | "briefMarkdown" | "summaryMarkdown">,
  options: { aiCall?: AiCallFn; aiAvailable?: boolean; timeoutMs?: number } = {},
): Promise<PrevisitQualityReport> {
  const available = options.aiAvailable ?? aiEnabled();
  if (!available) return fallback(result);
  try {
    const call = options.aiCall || callAi;
    const raw = await call(buildPrompt(markdownReport, result), { webSearch: false, timeoutMs: options.timeoutMs ?? 75_000 });
    const parsed = parse(raw.output);
    if (!parsed || !parsed.summary.headline || !parsed.summary.topRisks.length) {
      return { ...fallback(result), error: "AI 응답 형식 오류 — 규칙 기반으로 대체" };
    }
    return { enabled: true, source: "ai", model: raw.model, ...parsed };
  } catch (error) {
    return { ...fallback(result), error: error instanceof Error ? error.message : "품질 패스 실패" };
  }
}
