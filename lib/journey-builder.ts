/**
 * v4 고객 여정 생성 (PRD §7.5, §12)
 * AI 여정이 있으면 우선 사용, 없거나 휴리스틱 분류면 모델별 기본 여정 생성.
 */
import type { BusinessProfile, CustomerJourney, MarketMotion } from "./business-profile-types";

const TEMPLATES: Partial<Record<MarketMotion, Omit<CustomerJourney, "id" | "audienceId" | "priority">>> = {
  b2c_service: { label: "개인 고객 상담·예약", marketMotion: "b2c_service", objective: "book_service", buyingCycle: "short", expectedCtas: ["예약", "상담 신청", "전화", "카카오톡 문의"], expectedEvidence: ["가격·이용 절차", "후기·리뷰", "지역 정보"] },
  b2b_service: { label: "기업 고객 제안·도입", marketMotion: "b2b_service", objective: "request_proposal", buyingCycle: "long", expectedCtas: ["사업 제안 문의", "도입 상담", "회사소개서 다운로드"], expectedEvidence: ["고객사·수행 사례", "성과·전문성", "서비스 범위"] },
  b2g: { label: "공공기관 사업 협력", marketMotion: "b2g", objective: "request_proposal", buyingCycle: "procurement", expectedCtas: ["사업 제안·협력 문의", "용역 문의", "소개 자료"], expectedEvidence: ["수행 사업 사례·발주기관", "인증·등록 정보", "연구·운영 범위"] },
  b2b2c: { label: "참여자 프로그램 신청", marketMotion: "b2b2c", objective: "apply_program", buyingCycle: "short", expectedCtas: ["프로그램 보기", "참여 신청"], expectedEvidence: ["프로그램 대상·일정", "참여자 경험"] },
  b2g2c: { label: "시민·참여자 프로그램 신청", marketMotion: "b2g2c", objective: "apply_program", buyingCycle: "short", expectedCtas: ["모집 프로그램 보기", "신청"], expectedEvidence: ["대상·자격·일정", "운영 기관 신뢰"] },
  d2c_ecommerce: { label: "온라인 구매", marketMotion: "d2c_ecommerce", objective: "buy_now", buyingCycle: "instant", expectedCtas: ["구매", "장바구니"], expectedEvidence: ["상품 상세·가격", "배송·환불 정책", "리뷰"] },
  retail_ecommerce: { label: "온라인 구매", marketMotion: "retail_ecommerce", objective: "buy_now", buyingCycle: "instant", expectedCtas: ["구매", "장바구니", "카테고리 탐색"], expectedEvidence: ["상품 발견 구조", "결제·배송 신뢰"] },
  saas: { label: "제품 체험·도입", marketMotion: "saas", objective: "start_trial", buyingCycle: "short", expectedCtas: ["무료체험", "데모 신청", "가격 보기"], expectedEvidence: ["제품 화면·기능", "도입 사례", "보안·개인정보"] },
  marketplace: { label: "공급자·수요자 온보딩", marketMotion: "marketplace", objective: "create_account", buyingCycle: "short", expectedCtas: ["가입", "등록", "찾기"], expectedEvidence: ["검증·안전 정책", "수수료·이용 정책"] },
  membership_community: { label: "회원 가입·참여", marketMotion: "membership_community", objective: "create_account", buyingCycle: "short", expectedCtas: ["가입", "멤버십 안내"], expectedEvidence: ["운영 주체", "회원 혜택"] },
  media_content: { label: "구독·재방문", marketMotion: "media_content", objective: "subscribe_content", buyingCycle: "instant", expectedCtas: ["구독", "뉴스레터"], expectedEvidence: ["콘텐츠 구조", "발행 주기"] },
  nonprofit_public_interest: { label: "후원·참여", marketMotion: "nonprofit_public_interest", objective: "donate", buyingCycle: "short", expectedCtas: ["후원", "참여"], expectedEvidence: ["미션·투명성", "성과 보고"] },
};

export function buildJourneys(profile: BusinessProfile): CustomerJourney[] {
  if (profile.journeys.length) return profile.journeys;
  const motions: MarketMotion[] = [profile.primaryMarketMotion, ...profile.secondaryMarketMotions]
    .filter((m) => m !== "unknown" && m !== "hybrid");
  const audienceId = profile.audiences[0]?.id || "a1";
  const journeys: CustomerJourney[] = [];
  motions.forEach((m, i) => {
    const t = TEMPLATES[m];
    if (!t) return;
    journeys.push({ ...t, id: `j${i + 1}`, audienceId, priority: i === 0 ? "primary" : "secondary" });
  });
  return journeys;
}
