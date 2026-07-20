/**
 * v4.2 사전진단 품질 패스 — AI 능력을 최대로 활용해 신뢰성·이해도를 높인다.
 *
 * 핵심 원칙: "쉬운 보고서"를 별도로 지어내지 않는다. 이미 완성된
 * 사전진단 상세 보고서(markdownReport) 원문을 AI에게 그대로 주고,
 * 그 내용을 쉬운 말로 요약·정리하게 한다 — 상세 보고서와 요약이
 * 서로 다른 이야기를 하는 문제(핀트 어긋남)를 근본적으로 막는다.
 *
 * v4.3: 두 가지 방식으로 그라운딩을 강화했다.
 *  1) reportExcerpt — v4 핵심 섹션(비즈니스 모델·여정·공통 기반·여정별 점수)은
 *     절대 잘리지 않도록 통째로 포함하고, 나머지 v3 상세 섹션만 넉넉히 발췌한다.
 *     (기존에는 원문 전체를 앞에서부터 9000자 자르기만 해서, 여정이 많은
 *     보고서는 뒷부분 여정 점수·로드맵·AI 전략 섹션이 AI에게 보이지 않았다.)
 *  2) anchorFacts — 제목만 주던 것을, 실제 취약/주의 체크 목록(제목+근거+조치),
 *     즉시 실행 항목·로드맵·AI 우선순위(설명 포함), 채널 신호(전화·카카오·폼 등
 *     실측 개수)까지 구조화된 사실로 제공한다. AI는 이 목록에 있는 항목만
 *     골라 쉬운 말로 바꿀 수 있고, 목록에 없는 위험·근거를 새로 지어낼 수 없다.
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
import { MARKET_MOTION_LABEL, type AdaptiveCheck } from "./business-profile-types";

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
type PartialResult = Omit<DiagnosisResult, "markdownReport" | "previsitQuality" | "briefMarkdown" | "summaryMarkdown">;

const QUALITY_FLAG_LABEL: Record<string, string> = {
  OVERCLAIM: "과장된 표현 주의",
  WEAK_EVIDENCE: "근거가 약함",
  TYPE_MISMATCH: "비즈니스 유형과 안 맞는 권고",
  OK: "특이사항 없음",
};

export function qualityFlagLabel(code: string): string {
  return QUALITY_FLAG_LABEL[code] || code;
}

/**
 * 상세 보고서 원문에서 AI 요약의 근거로 쓸 텍스트를 만든다.
 * v4 핵심 섹션(비즈니스 모델 분류·고객 여정·공통 기반·여정별 점수)은
 * 보고서 맨 앞에 있고 "# 상세 진단 (참고 — 기존 v3 채점)" 구분선 이전까지가
 * 그 전체다 — 이 부분은 잘라내지 않고 통째로 포함한다.
 * 그 뒤 v3 상세 섹션(축별 분석·AI 전략·경쟁사 비교·로드맵 등)은 넉넉한
 * 길이로 발췌한다(구체적 사실은 anchorFacts가 구조화된 형태로 별도 보장).
 */
function reportExcerpt(markdownReport: string, maxLegacyChars = 12000): string {
  const marker = "# 상세 진단 (참고 — 기존 v3 채점)";
  const idx = markdownReport.indexOf(marker);
  if (idx === -1) return markdownReport.slice(0, maxLegacyChars + 4000);
  const v4Part = markdownReport.slice(0, idx);
  const legacyPart = markdownReport.slice(idx, idx + maxLegacyChars);
  return `${v4Part}\n\n${legacyPart}`;
}

function checksFromCard(card: { checks: AdaptiveCheck[] }, scopeLabel: string) {
  return card.checks
    .filter((c) => c.status === "fail" || c.status === "warn")
    .map((c) => ({
      scope: scopeLabel,
      title: c.title,
      severity: c.status === "fail" ? "취약" : "주의",
      detail: c.detail,
      action: c.action,
    }));
}

/**
 * 원문 grounding을 보완하는 정밀 구조화 데이터.
 * AI가 실제 목록에 없는 위험·근거·항목을 지어내는 것을 막기 위해,
 * 제목뿐 아니라 근거(detail)·조치(action)·설명(description)까지 그대로 준다.
 */
function anchorFacts(result: PartialResult): string {
  const a = result.adaptiveScores;
  const failWarnChecks = [
    checksFromCard(a.coreReadiness, "공통 기반"),
    ...a.journeyScores.map((j) => checksFromCard(j, j.journeyLabel)),
  ].flat().slice(0, 24);

  return JSON.stringify({
    company: result.input.company || result.siteTitle,
    businessModel: MARKET_MOTION_LABEL[result.businessProfile.primaryMarketMotion],
    confidenceLabel: result.businessProfile.confidenceLabel,
    overallGrade: a.grade,
    provisional: a.provisional,
    failWarnChecks,
    quickWins: result.quickWins.slice(0, 6).map((q) => ({
      title: q.title,
      description: q.description,
      impact: q.impact,
      effort: q.effort,
    })),
    roadmap: result.roadmap.slice(0, 8).map((r) => ({
      phase: r.phase,
      title: r.title,
      description: r.description,
      expectedOutcome: r.expectedOutcome,
    })),
    aiPriorities: result.aiPrecheck.priorities.slice(0, 6).map((p) => ({
      title: p.title,
      reason: p.reason,
      action: p.action,
      impact: p.impact,
    })),
    highImpactPriorities: result.highImpactPriorities.slice(0, 6),
    channelSignals: result.conversion?.paths || null,
  });
}

function buildPrompt(markdownReport: string, result: PartialResult): string {
  return [
    "당신은 사회적기업 대상 AX(AI 전환) 마케팅 컨설턴트의 수석 보좌역입니다.",
    "아래는 이미 완성된 '사전진단 상세 보고서' 원문(발췌)과, 그 보고서를 만든 실제 데이터(anchorFacts)입니다.",
    "이 두 가지에 실제로 있는 내용만 근거로 사용하세요. 보고서나 anchorFacts에 없는 사실·위험·수치를 새로 지어내지 마세요.",
    "",
    "매우 중요한 규칙:",
    "- summary.topRisks와 previsitBrief.expectedPainPoints는 반드시 anchorFacts.failWarnChecks 목록에 있는 항목만 골라 쉬운 말로 바꾸세요. 목록에 없는 위험을 추가하지 마세요.",
    "- summary.quickWinsPlain은 반드시 anchorFacts.quickWins 목록에 있는 항목만 골라 쉬운 말로 바꾸세요.",
    "- previsitBrief.talkingPoints는 anchorFacts.aiPriorities 또는 anchorFacts.roadmap 중에서 골라 쉬운 말로 바꾸세요.",
    "- 각 항목의 '근거(evidence/whyPlain)'는 anchorFacts의 detail·reason·description 필드 내용을 쉬운 말로 옮긴 것이어야 합니다. 근거 없이 판단만 쓰지 마세요.",
    "",
    "전문용어(SEO, CTA, 전환율, 메타태그, N/A, 신뢰도, 여정, primary, hybrid 등)는 60대 기업 대표도 이해할 일상 언어로 풀어 쓰세요.",
    "영어 단어를 한국어 문장에 그대로 섞지 마세요. B2C·B2B·B2G 같은 굳어진 업계 약어는 괜찮습니다.",
    "보고서 내용이 잘못되었거나 과장되어 보이면 qualityFlags에 지적하세요.",
    "",
    "=== 사전진단 상세 보고서 원문(발췌 — v4 핵심 섹션은 전체 포함) ===",
    reportExcerpt(markdownReport),
    "=== 발췌 끝 ===",
    "",
    "=== anchorFacts (보고서를 만든 실제 데이터 — 이 안에서만 항목을 고르세요) ===",
    anchorFacts(result),
    "=== anchorFacts 끝 ===",
    "",
    "다음 JSON만 출력하세요(코드블록·설명 금지):",
    '{"summary":{"headline":"보고서의 핵심 결론을 한 문장으로(쉬운 말)","whatWeChecked":"무엇을 어떻게 진단했는지 2~3문장(쉬운 말)","topRisks":[{"title":"failWarnChecks 중에서 고른 항목 제목을 쉬운 말로","whyPlain":"해당 항목의 detail을 근거로 왜 문제인지 1~2문장","todo":"해당 항목의 action을 바탕으로 이번 주에 할 수 있는 첫 조치 1문장"}],"quickWinsPlain":["anchorFacts.quickWins 중에서 골라 쉬운 말로 3~4개"]},',
    '"previsitBrief":{"companySnapshot":"보고서 내용 기반 기업 한 단락 요약(모델·고객·강점·약점)","channelSnapshot":["anchorFacts.channelSignals와 보고서 내용을 근거로 채널별 현황 한 줄씩 3~5개"],"expectedPainPoints":[{"point":"failWarnChecks 중에서 고른 항목","evidence":"해당 항목의 detail"}],"meetingQuestions":["방문 미팅에서 확인할 질문 8~10개 — 지원사업 의존도, 매출 구성, 운영 인력, 콘텐츠 담당, 실제 문의 경로 포함"],"talkingPoints":["aiPriorities 또는 roadmap 중에서 골라 미팅에서 강조할 포인트 3~4개(근거 기반)"]},',
    '"qualityFlags":[{"code":"OVERCLAIM|WEAK_EVIDENCE|TYPE_MISMATCH|OK","message":"설명"}]}',
    "",
    "topRisks는 failWarnChecks 중 severity가 '취약'인 항목을 우선해 3~5개만. 모든 문장은 한국어 존댓말.",
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

function fallback(result: PartialResult): PrevisitQualityReport {
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
  result: PartialResult,
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
