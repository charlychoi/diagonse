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
    "D1~D6 실측·체크 입력 기반. 정상=1 / 주의=0.5 / 취약=0, 미입력 제외 후 가중 재배분",
  authoritative: true,
  weights: { d1: 15, d2: 10, d3: 25, d4: 15, d5: 15, d6: 20 },
};

/** URL crawl screening scale */
export const SURFACE_SCORE = {
  id: "surface_url" as const,
  label: "표면 신호 점수",
  labelEn: "Surface Score",
  method:
    "공개 HTML 경량 크롤 휴리스틱. 검색 순위·채널 운영·전환 병목 실측을 포함하지 않음",
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
      reason: "HTML 수집 실패·차단 — 공개 신호 부족, 추정 비중 큼",
      dampen: 0.82,
    };
  }
  if (signals.pageCountCrawled === 1 && core <= 2) {
    return {
      confidence: "low",
      reason: "단일 페이지만 수집되었고 핵심 메타/H1 신호가 약함",
      dampen: 0.88,
    };
  }
  if (signals.pageCountCrawled === 1) {
    return {
      confidence: "medium",
      reason: "홈 1페이지만 분석 — 검색·채널·전환 실측은 미포함 (중간 신뢰)",
      dampen: 0.94,
    };
  }
  if (core >= 3 && signals.pageCountCrawled >= 2) {
    return {
      confidence: "medium",
      reason: "복수 페이지 수집 — 표면 신호는 양호하나 6대 실측 대비 신뢰 한도 있음",
      dampen: 0.97,
    };
  }
  return {
    confidence: "medium",
    reason: "제한된 페이지 신호 기반 중간 신뢰",
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
    reasons.push("URL 표면 진단 절대 상한 82 (구조 우수 판정은 6대 실측 필요)");
  } else if (!reasons.some((r) => r.includes("절대 상한"))) {
    reasons.push("URL 표면 진단 절대 상한 82");
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
      `이 숫자는 "${SURFACE_SCORE.label}"입니다. 6대 자가진단의 "${STRUCTURE_SCORE.label}"와 척도가 다릅니다. ` +
      `표면 점수가 높아도 검색 색인·콘텐츠 CTA·전환 병목·브랜드 신호(NAP)가 약하면 구조 점수는 크게 낮아질 수 있습니다. ` +
      `현재 표면 점수 기준 구조 점수 예상 대역은 약 ${range.low}~${range.high}점입니다.`,
    nextStep:
      "신뢰 가능한 최종 점수가 필요하면 6대 자가진단(실측 체크)을 완료하세요. 구조 진단 점수가 컨설팅 기준 점수입니다.",
    expectedStructureRange: range,
  };

  return { overall, reliability };
}

export const SCORE_COMPARISON_HELP = {
  title: "왜 URL 자동진단과 6대 자가진단 점수가 다른가요?",
  bullets: [
    "측정 대상이 다름: URL=공개 HTML 표면 / 6대=검색·콘텐츠 운영·채널·전환·브랜드 실측",
    "점수 산식이 다름: URL=가산점 휴리스틱 / 6대=정상·주의·취약 삼진 + 가중(콘텐츠 25%·브랜드 20%)",
    "낙관 편향: 메타·OG·반응형만 있어도 URL 점수는 쉽게 오르지만, CTA 0%·전환 차단이면 6대는 급락",
    "최종 기준: 구조 진단 점수(6대) · URL 점수는 스크리닝·우선순위 힌트용",
  ],
};
