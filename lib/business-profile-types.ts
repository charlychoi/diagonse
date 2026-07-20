/**
 * v4 비즈니스 모델 적응형 진단 — 분류 타입 (PRD §7, §8)
 */

export type MarketMotion =
  | "b2c_service" | "b2b_service" | "b2g" | "b2b2c" | "b2g2c"
  | "d2c_ecommerce" | "retail_ecommerce" | "saas" | "marketplace" | "social_enterprise"
  | "membership_community" | "media_content" | "nonprofit_public_interest"
  | "hybrid" | "unknown";

export const MARKET_MOTION_LABEL: Record<MarketMotion, string> = {
  b2c_service: "개인 대상 서비스(B2C)",
  b2b_service: "기업 대상 서비스(B2B)",
  b2g: "공공기관 대상(B2G)",
  b2b2c: "기업 구매·개인 사용(B2B2C)",
  b2g2c: "공공 구매·시민 수혜(B2G2C)",
  d2c_ecommerce: "자체 상품 온라인 판매(D2C)",
  retail_ecommerce: "온라인 판매(전문몰·종합몰)",
  saas: "소프트웨어 구독(SaaS)",
  marketplace: "플랫폼·마켓플레이스",
  membership_community: "회원·커뮤니티",
  media_content: "콘텐츠·미디어",
  nonprofit_public_interest: "비영리·공익",
  social_enterprise: "사회적기업(공공판로+시장매출 혼합)",
  hybrid: "복합(2개 이상 핵심)",
  unknown: "분류 보류",
};

export type RevenueMotion =
  | "instant_purchase" | "reservation_payment" | "quote_and_contract"
  | "project_contract" | "public_procurement" | "subscription" | "commission"
  | "advertising_sponsorship" | "membership_fee" | "grant_donation"
  | "free_public_program" | "mixed" | "unknown";

export type SiteRole =
  | "corporate_credibility" | "lead_generation" | "proposal_support"
  | "program_recruitment" | "ecommerce_sales" | "product_signup"
  | "marketplace_matching" | "content_discovery" | "customer_support"
  | "investor_recruiting" | "mixed";

export type ConversionGoal =
  | "buy_now" | "add_to_cart" | "book_service" | "call_or_chat"
  | "request_quote" | "request_proposal" | "contact_sales"
  | "download_company_profile" | "view_case_study" | "apply_program"
  | "register_jobseeker" | "register_employer" | "start_trial"
  | "create_account" | "subscribe_content" | "partner_inquiry" | "donate";

export const CONVERSION_GOAL_LABEL: Record<ConversionGoal, string> = {
  buy_now: "바로 구매하기",
  add_to_cart: "장바구니에 담기",
  book_service: "예약하기",
  call_or_chat: "전화·메신저로 상담하기",
  request_quote: "견적 요청하기",
  request_proposal: "사업 제안 문의하기",
  contact_sales: "도입 상담 문의하기",
  download_company_profile: "회사소개서 받아보기",
  view_case_study: "수행 사례 확인하기",
  apply_program: "프로그램 신청하기",
  register_jobseeker: "구직자로 등록하기",
  register_employer: "기업회원으로 등록하기",
  start_trial: "무료로 체험해보기",
  create_account: "회원가입하기",
  subscribe_content: "뉴스레터 구독하기",
  partner_inquiry: "제휴·협력 문의하기",
  donate: "후원하기",
};

export type BuyingCycle = CustomerJourney["buyingCycle"];
export const BUYING_CYCLE_LABEL: Record<BuyingCycle, string> = {
  instant: "그 자리에서 바로 결정",
  short: "며칠~몇 주 안에 결정",
  long: "몇 달에 걸쳐 검토 후 결정",
  procurement: "공공 조달 절차를 거쳐 결정",
  unknown: "결정 기간 확인 필요",
};

export type AudienceRole =
  | "economicBuyer" | "decisionMaker" | "influencer"
  | "endUser" | "beneficiary" | "supplierPartner";

export type AudienceProfile = {
  id: string;
  label: string;
  roles: AudienceRole[];
  organizationType?: string;
  needs: string[];
  expectedProof: string[];
};

export type CustomerJourney = {
  id: string;
  label: string;
  audienceId: string;
  marketMotion: MarketMotion;
  objective: ConversionGoal;
  priority: "primary" | "secondary" | "supporting";
  buyingCycle: "instant" | "short" | "long" | "procurement" | "unknown";
  expectedCtas: string[];
  expectedEvidence: string[];
};

export type ClassificationEvidence = {
  claim: string;
  evidenceText: string;
  sourceUrl: string;
  sourceType: "homepage" | "service_page" | "official_external";
  strength: "strong" | "medium" | "weak";
};

export type AlternativeHypothesis = {
  marketMotion: MarketMotion;
  reason: string;
};

export type BusinessProfile = {
  version: "1.0";
  primaryMarketMotion: MarketMotion;
  secondaryMarketMotions: MarketMotion[];
  isHybrid: boolean;
  revenueMotions: RevenueMotion[];
  siteRoles: SiteRole[];
  audiences: AudienceProfile[];
  journeys: CustomerJourney[];
  primaryObjectiveId: string | null;
  confidence: number; // 0..1
  confidenceLabel: "high" | "medium" | "low";
  evidence: ClassificationEvidence[];
  alternativeHypotheses: AlternativeHypothesis[];
  source: "ai_web" | "ai_site_only" | "heuristic" | "user_override";
  needsConfirmation: boolean;
};

/** v4 확장 진단 상태 (§8.2) */
export type AdaptiveStatus = "pass" | "warn" | "fail" | "manual" | "not_applicable" | "not_observed";

export type AdaptiveCheck = {
  id: string;
  title: string;
  status: AdaptiveStatus;
  detail: string;
  action: string;
};

export type ScoreCard = {
  id: string;
  label: string;
  /** null → 적용 항목 3개 미만이라 숫자 점수를 만들지 않음 (§11.3) */
  score: number | null;
  applicableCount: number;
  naCount: number;
  notObservedCount: number;
  checks: AdaptiveCheck[];
  narrative: string;
};

export type JourneyScoreCard = ScoreCard & {
  journeyId: string;
  journeyLabel: string;
  marketMotion: MarketMotion;
  priority: CustomerJourney["priority"];
};

export type AdaptiveDiagnosisScores = {
  coreReadiness: ScoreCard;
  journeyScores: JourneyScoreCard[];
  primaryJourneyScore: number | null;
  overallScore: number | null;
  grade: "A" | "B" | "C" | "D" | "F" | null;
  provisional: boolean;
  confidence: number;
  scoringProfileId: string;
};

/** businessProfileOverride API 입력 (§17.1) */
export type BusinessProfileOverride = {
  primaryMarketMotion: MarketMotion;
  secondaryMarketMotions?: MarketMotion[];
};

export const B2C_LIKE: MarketMotion[] = ["b2c_service"];
export const ECOMMERCE_LIKE: MarketMotion[] = ["d2c_ecommerce", "retail_ecommerce"];
export const ORG_BUYER_LIKE: MarketMotion[] = ["b2b_service", "b2g", "b2b2c", "b2g2c"];

export function isOrgBuyerMotion(m: MarketMotion): boolean {
  return ORG_BUYER_LIKE.includes(m);
}
export function isEcommerceMotion(m: MarketMotion): boolean {
  return ECOMMERCE_LIKE.includes(m);
}
