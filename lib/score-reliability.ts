/**
 * Score reliability framework — unifies how MarkDiag presents scores.
 *
 * Root cause of 78 vs 50 style gaps:
 * - URL auto: HTML surface heuristics (title/meta/og/CTA strings) → optimistic floor
 * - 6대 자가진단: human-verified structure (search index, content ops, funnel, brand signals)
 *   with ternary status (정상=1 / 주의=0.5 / 취약=0) and consulting weights
 *
 * Policy:
 * 1. Two named scales — never present as interchangeable "종합 점수"
 * 2. Structure (D1–D6) is the authoritative consulting score
 * 3. Surface (URL) is a low/medium-confidence screening score with ceilings
 * 4. UI always shows method, confidence, and cross-scale guidance
 */

import type { DiagnosisAxisKey } from "./types";
import type { ParsedSiteSignals } from "./crawl";

/** Authoritative consulting scale (self-check D1–D6) */
export const STRUCTURE_SCORE = {
  id: "structure_d6" as const,
  label: "구조 진단 점수",
  labelEn: "Structure Score",
  method:
    "6가지 항목에 직접 답하며 진행하는 정밀 진단 기준. 각 항목을 정상/주의/취약으로 답하면, 안 다룬 항목은 빼고 나머지 비중을 다시 나눠 계산합니다.",
  authoritative: true,
  weights: { d1: 15, d2: 10, d3: 25, d4: 15, d5: 15, d6: 20 },
};

/** URL crawl screening scale */
export const SURFACE_SCORE = {
  id: "surface_url" as const,
  label: "AI 진단 점수",
  labelEn: "AI Diagnosis Score",
  method:
    "AI가 홈페이지에 게시된 콘텐츠·구조·메시지를 분석해 매긴 점수. 실시간 검색 순위, 채널 운영 이력, 실제 상담 전환 과정은 별도 확인이 필요합니다.",
  authoritative: false,
};

/** Axis weights aligned toward consulting priorities (content / conversion / authority) */
export const SURFACE_AXIS_WEIGHTS: Record<DiagnosisAxisKey, number> = {
  brand: 15,
  contentSeo: 28,
  uxConversion: 22,
  socialPaid: 15,
  authorityAi: 20,
};

export type ScoreConfidence = "low" | "medium" | "high";

export type ScoreReliability = {
  scaleId: typeof SURFACE_SCORE.id | typeof STRUCTURE_SCORE.id;
  scaleLabel: string;
  method: string;
  authoritative: boolean;
  confidence: ScoreConfidence;
  confidenceReason: string;
  /** Raw weighted average before ceilings / confidence dampening */
  rawScore: number;
  /** Applied ceiling (null if none) */
  ceilingApplied: number | null;
  ceilingReason: string | null;
  /** Guidance when comparing to the other scale */
  crossScaleNote: string;
  /** Suggested next step for higher reliability */
  nextStep: string;
  /** Expected structure-score band if user later runs D1–D6 (heuristic bridge) */
  expectedStructureRange: { low: number; high: number } | null;
};

export function gradeFromScore(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function weightedAverage(
  axes: { key: DiagnosisAxisKey; score: number }[],
  weights: Record<DiagnosisAxisKey, number> = SURFACE_AXIS_WEIGHTS,
): number {
  let sum = 0;
  let wSum = 0;
  for (const a of axes) {
    const w = weights[a.key] ?? 1;
    sum += a.score * w;
    wSum += w;
  }
  return wSum ? Math.round(sum / wSum) : 0;
}

/**
 * Evidence quality from crawl depth + core meta presence.
 * High confidence is intentionally rare for URL-only diagnosis.
 */
export function assessSurfaceConfidence(signals: ParsedSiteSignals): {
  confidence: ScoreConfidence;
  reason: string;
  dampen: number;
} {
  const core =
    (signals.title ? 1 : 0) +
    (signals.description ? 1 : 0) +
    (signals.h1s.length > 0 ? 1 : 0) +
    (signals.hasViewport ? 1 : 0);

  if (signals.pageCountCrawled === 0) {
    return {
      confidence: "low",
      reason: "홈페이지 접속이 차단되어 있어 AI가 콘텐츠를 충분히 가져오지 못했습니다",
      dampen: 0.82,
    };
  }
  if (signals.pageCountCrawled === 1 && core <= 2) {
    return {
      confidence: "low",
      reason: "한 페이지만 분석했고 제목·H1 같은 핵심 정보도 부족합니다",
      dampen: 0.88,
    };
  }
  if (signals.pageCountCrawled === 1) {
    return {
      confidence: "medium",
      reason: "홈페이지 1개 페이지를 분석했습니다 — 실제 검색 노출·채널 운영·상담 전환까지는 포함하지 않습니다",
      dampen: 0.94,
    };
  }
  if (core >= 3 && signals.pageCountCrawled >= 2) {
    return {
      confidence: "medium",
      reason: "여러 페이지를 분석해 근거는 충분하나, 실제 검색·상담 데이터까지 확인한 것은 아닙니다",
      dampen: 0.97,
    };
  }
  return {
    confidence: "medium",
    reason: "일부 페이지만 분석되어 중간 수준의 신뢰도로 판단했습니다",
    dampen: 0.93,
  };
}

/**
 * Hard ceilings: surface polish must not claim "excellent" without conversion/authority signals.
 * Prevents 75–85+ scores on marketing-looking HTML that still fail D3/D5/D6 structure tests.
 */
export function surfaceCeilings(signals: ParsedSiteSignals): {
  ceiling: number | null;
  reason: string | null;
} {
  const reasons: string[] = [];
  let ceiling = 100;

  if (signals.pageCountCrawled === 0) {
    ceiling = Math.min(ceiling, 52);
    reasons.push("페이지 미수집 시 상한 52");
  }

  if (!signals.hasCtaHints && !signals.hasForm) {
    ceiling = Math.min(ceiling, 62);
    reasons.push("CTA·폼 신호 없음 → 전환 관점 상한 62");
  }

  if (!signals.hasAnalyticsHints && !(signals.hasJsonLd || signals.hasSchemaOrg)) {
    ceiling = Math.min(ceiling, 70);
    reasons.push("측정 태그·구조화 데이터 모두 약함 → 상한 70");
  }

  if (!signals.hasBlog && signals.wordCount < 400) {
    ceiling = Math.min(ceiling, 68);
    reasons.push("콘텐츠 허브·본문 분량 부족 → 상한 68");
  }

  if (signals.socialLinks.length === 0 && !signals.hasOg) {
    ceiling = Math.min(ceiling, 74);
    reasons.push("소셜·OG 약함 → 상한 74");
  }

  // Even with full surface signals, URL-only cannot exceed 82 (structure excellence needs D-scale)
  ceiling = Math.min(ceiling, 82);
  if (ceiling === 82 && reasons.length === 0) {
    reasons.push("AI 진단 점수 자체의 상한선은 82점 — 그 이상의 우수 판정은 6대 자가진단으로 직접 확인 필요");
  } else if (!reasons.some((r) => r.includes("상한선"))) {
    reasons.push("AI 진단 점수 자체의 상한선은 82점");
  }

  if (ceiling >= 100) return { ceiling: null, reason: null };
  return { ceiling, reason: reasons.join(" · ") };
}

/** Bridge: rough expected D1–D6 band from a calibrated surface score */
export function expectedStructureRange(
  surfaceScore: number,
  confidence: ScoreConfidence,
): { low: number; high: number } {
  const spread = confidence === "low" ? 18 : confidence === "medium" ? 14 : 10;
  // High surface often overstates structure (ops/funnel/index gaps).
  // Mid/low surface is already conservative — structure usually nearby ±spread.
  if (surfaceScore >= 68) {
    const center = Math.round(surfaceScore * 0.7);
    return {
      low: Math.max(0, center - spread),
      high: Math.min(100, center + 8),
    };
  }
  return {
    low: Math.max(0, surfaceScore - spread),
    high: Math.min(100, surfaceScore + Math.round(spread * 0.7)),
  };
}

export function finalizeSurfaceScore(
  axes: { key: DiagnosisAxisKey; score: number }[],
  signals: ParsedSiteSignals,
): { overall: number; reliability: ScoreReliability } {
  const raw = weightedAverage(axes);
  const conf = assessSurfaceConfidence(signals);
  const damped = Math.round(raw * conf.dampen);
  const { ceiling, reason: ceilingReason } = surfaceCeilings(signals);
  const overall = ceiling != null ? Math.min(damped, ceiling) : damped;
  const range = expectedStructureRange(overall, conf.confidence);

  const reliability: ScoreReliability = {
    scaleId: SURFACE_SCORE.id,
    scaleLabel: SURFACE_SCORE.label,
    method: SURFACE_SCORE.method,
    authoritative: false,
    confidence: conf.confidence,
    confidenceReason: conf.reason,
    rawScore: raw,
    ceilingApplied: ceiling != null && damped > ceiling ? ceiling : null,
    ceilingReason:
      ceiling != null && damped > ceiling ? ceilingReason : ceilingReason,
    crossScaleNote:
      `이 숫자는 "${SURFACE_SCORE.label}"입니다 — AI가 홈페이지에 게시된 콘텐츠와 구조를 분석해 매긴 점수입니다. 직접 답하며 진행하는 "${STRUCTURE_SCORE.label}"(6대 자가진단)과는 채점 방식이 달라 그대로 비교할 수 없습니다. ` +
      `AI 진단 점수가 높아도 실제 검색 노출, 문의·상담으로 이어지는 과정, 상호·주소·전화번호 통일 같은 부분은 직접 확인해야 정확히 알 수 있어, 6대 자가진단 점수는 다르게 나올 수 있습니다. ` +
      `지금 점수를 기준으로 6대 자가진단을 진행하면 대략 ${range.low}~${range.high}점 사이가 나올 것으로 예상됩니다(참고용 추정치).`,
    nextStep:
      "실제 상담 전환·검색 순위까지 반영한 최종 점수가 필요하면 6대 자가진단(직접 답하며 진행하는 정밀 진단)을 진행해 보세요.",
    expectedStructureRange: range,
  };

  return { overall, reliability };
}

export const SCORE_COMPARISON_HELP = {
  title: "왜 AI 진단 점수와 6대 자가진단 점수가 다른가요?",
  bullets: [
    "보는 대상이 다릅니다: AI 진단은 공개된 홈페이지 콘텐츠와 구조를 분석하고, 6대 자가진단은 검색 노출·콘텐츠 운영·채널·상담 전환·브랜드까지 직접 확인해서 매깁니다.",
    "계산 방식이 다릅니다: AI 진단은 있으면 가점을 더하는 방식이고, 6대 자가진단은 정상/주의/취약 3단계로 답한 뒤 항목별 비중(콘텐츠 25%·브랜드 20% 등)을 반영해 계산합니다.",
    "AI 진단 점수는 후하게 나오기 쉽습니다: 요약 설명·공유 미리보기·모바일 대응만 있어도 점수가 쉽게 오르지만, 실제로 문의 버튼이 안 눌리거나 상담이 막히면 6대 자가진단 점수는 크게 떨어질 수 있습니다.",
    "실제 컨설팅 기준 점수는 6대 자가진단입니다 — AI 진단 점수는 어디부터 손볼지 우선순위를 잡는 참고용입니다.",
  ],
};
