/**
 * v4 여정별 점수 계산 — N/A 분모 제외 (PRD §11.3)
 */
import type { AdaptiveCheck, ScoreCard } from "../business-profile-types";

const POINTS: Record<string, number> = { pass: 1, warn: 0.5, fail: 0, not_observed: 0.25 };

/**
 * - not_applicable → 분모 제외
 * - manual → 분모 제외(직접 확인)
 * - not_observed → 자동 실패 아님(0.25 부분 점수, §8.2)
 * - 적용 항목 3개 미만 → score=null (서술형 대체)
 */
export function computeScoreCard(id: string, label: string, checks: AdaptiveCheck[], narrativeWhenThin?: string): ScoreCard {
  const na = checks.filter((c) => c.status === "not_applicable");
  const manual = checks.filter((c) => c.status === "manual");
  const notObserved = checks.filter((c) => c.status === "not_observed");
  const applicable = checks.filter((c) => c.status !== "not_applicable" && c.status !== "manual");
  const score = applicable.length >= 3
    ? Math.round((applicable.reduce((s, c) => s + (POINTS[c.status] ?? 0), 0) / applicable.length) * 100)
    : null;
  const narrative = score === null
    ? (narrativeWhenThin || "적용 가능한 자동 점검 항목이 3개 미만이라 숫자 점수 대신 서술형으로 안내합니다.")
    : score >= 75 ? "이 여정의 온라인 준비도가 비교적 잘 갖춰져 있습니다."
    : score >= 50 ? "핵심 경로는 있으나 보강이 필요합니다."
    : "이 여정의 핵심 전환 경로가 부족합니다.";
  return { id, label, score, applicableCount: applicable.length, naCount: na.length + manual.length, notObservedCount: notObserved.length, checks, narrative };
}

/** N/A 비율 40% 초과 시 해당 점수표 숨김 대상 (§11.3) */
export function shouldHideCard(card: ScoreCard): boolean {
  const total = card.applicableCount + card.naCount;
  return total > 0 && card.naCount / total > 0.4 && card.score === null;
}
