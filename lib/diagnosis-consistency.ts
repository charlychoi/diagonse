/**
 * v4 일관성 검증기 (PRD §20)
 * 치명 모순은 보고서 실패 대신 보수적 문구 대체 + 경고 기록.
 */
import type { AdaptiveDiagnosisScores, BusinessProfile } from "./business-profile-types";
import { isOrgBuyerMotion, isEcommerceMotion } from "./business-profile-types";

export type ConsistencyWarning = { code: string; message: string };

export function validateConsistency(
  profile: BusinessProfile,
  scores: AdaptiveDiagnosisScores,
  legacy: { conversionChecks: { id: string; status: string }[]; executiveSummary: string },
): ConsistencyWarning[] {
  const warnings: ConsistencyWarning[] = [];
  const primary = profile.primaryMarketMotion;

  if (isOrgBuyerMotion(primary)) {
    const b2cFails = legacy.conversionChecks.filter((c) => /tel|kakao|booking/.test(c.id) && c.status === "fail");
    if (b2cFails.length) warnings.push({ code: "B2C_CHECK_ON_ORG_BUYER", message: "B2B/B2G 프로필에 B2C 전용 항목(전화·카카오·예약)이 실패로 계산되어 여정 점수에서 제외했습니다." });
  }
  if (isEcommerceMotion(primary)) {
    const hasCart = scores.journeyScores.some((j) => j.checks.some((c) => c.id === "ec-cart"));
    if (!hasCart) warnings.push({ code: "ECOMMERCE_NO_CART_CHECK", message: "이커머스 프로필인데 장바구니·결제 항목이 평가되지 않았습니다." });
  }
  if (isOrgBuyerMotion(primary) && /부가\s?사업|희석/.test(legacy.executiveSummary)) {
    warnings.push({ code: "B2B_AS_DILUTION", message: "B2B가 부가 사업·희석 요소로 표현된 문구를 보고서에서 조정했습니다." });
  }
  const buyers = profile.audiences.filter((a) => a.roles.includes("economicBuyer"));
  const users = profile.audiences.filter((a) => a.roles.includes("endUser") || a.roles.includes("beneficiary"));
  if (buyers.length && users.length && buyers[0]?.id !== users[0]?.id && profile.journeys.length < 2) {
    warnings.push({ code: "SINGLE_JOURNEY_FOR_DUAL_AUDIENCE", message: "구매자와 수혜자가 다른데 여정이 하나만 생성되었습니다." });
  }
  if (scores.provisional && scores.grade !== null) {
    warnings.push({ code: "GRADE_ON_LOW_CONFIDENCE", message: "저신뢰도 분류인데 확정 등급이 생성되어 임시 표시로 전환했습니다." });
  }
  return warnings;
}
