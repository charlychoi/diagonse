/**
 * v4 유형별 채점 프로필 (PRD §11.2, §12.2)
 * 각 체크는 applicability를 먼저 평가하고, 관련 없으면 not_applicable로 등록조차 하지 않는다.
 */
import type { ParsedSiteSignals } from "../crawl";
import type { AdaptiveCheck, CustomerJourney, JourneyScoreCard, MarketMotion } from "../business-profile-types";
import { computeScoreCard } from "./journey-score";

type Ctx = {
  signals: ParsedSiteSignals;
  journey: CustomerJourney;
  text: string; // lowercase 검색용 텍스트
};

const has = (ctx: Ctx, re: RegExp) => re.test(ctx.text);
const conv = (s: ParsedSiteSignals) => s.conversion || { ctaTexts: [], telLinks: [], mailtoLinks: [], kakaoLinks: [], naverTalkLinks: [], bookingLinks: [], contactPageUrls: [], formCount: s.hasForm ? 1 : 0 };

function check(id: string, title: string, ok: boolean | "warn" | "not_observed", detailOk: string, detailNo: string, action: string): AdaptiveCheck {
  const status = ok === true ? "pass" : ok === "warn" ? "warn" : ok === "not_observed" ? "not_observed" : "not_observed";
  return { id, title, status, detail: status === "pass" ? detailOk : detailNo, action };
}

/** fail을 명시해야 하는 항목(핵심 경로 부재)을 위한 헬퍼 */
function hardCheck(id: string, title: string, ok: boolean, detailOk: string, detailNo: string, action: string, missing: "fail" | "not_observed" = "not_observed"): AdaptiveCheck {
  return { id, title, status: ok ? "pass" : missing, detail: ok ? detailOk : detailNo, action };
}

const BUILDERS: Partial<Record<MarketMotion, (ctx: Ctx) => AdaptiveCheck[]>> = {
  b2c_service: (ctx) => {
    const c = conv(ctx.signals);
    const consult = c.kakaoLinks.length + c.naverTalkLinks.length + c.bookingLinks.length;
    return [
      hardCheck("b2c-booking", "예약·상담 경로", consult > 0 || c.formCount > 0, `상담·예약 경로 ${consult + c.formCount}개`, "예약·카카오·네이버 상담 경로가 없습니다.", "예약 또는 메신저 상담 버튼을 첫 화면에 배치하세요.", "fail"),
      hardCheck("b2c-tel", "모바일 전화 전환(tel:)", c.telLinks.length > 0, `전화 링크 ${c.telLinks.length}개`, "클릭해서 걸 수 있는 전화 링크가 없습니다.", "대표번호를 tel: 링크로 연결하세요.", "fail"),
      check("b2c-price", "가격·이용 절차 안내", has(ctx, /가격|비용|요금|이용\s?절차|이용\s?방법/), "가격·절차 안내 감지", "가격·이용 절차 안내가 확인되지 않습니다.", "대표 가격대와 이용 절차를 공개하세요."),
      check("b2c-review", "후기·리뷰 신뢰", has(ctx, /후기|리뷰|만족도|이용\s?사례/), "후기·리뷰 신호 감지", "후기·리뷰가 확인되지 않습니다.", "실제 이용 후기를 홈페이지에 노출하세요."),
      check("b2c-local", "지역 정보", has(ctx, /오시는\s?길|주소|지도|위치|지점/), "지역·위치 정보 감지", "지역·위치 정보가 확인되지 않습니다.", "주소·지도·상권 정보를 명시하세요."),
    ];
  },
  b2b_service: (ctx) => {
    const c = conv(ctx.signals);
    return [
      check("b2b-buyer", "구매 담당자 대상 메시지", has(ctx, /기업|기관|담당자|도입|파트너/), "조직 고객 대상 메시지 감지", "어떤 조직 문제를 해결하는지 명확하지 않습니다.", "구매 담당자가 이해할 문제·성과 중심 메시지를 배치하세요."),
      check("b2b-cases", "고객사·수행 사례", has(ctx, /고객사|사례|실적|레퍼런스|수행/), "사례·실적 신호 감지", "고객사·수행 사례가 확인되지 않습니다.", "대표 사례와 성과를 별도 페이지로 정리하세요."),
      hardCheck("b2b-inquiry", "제안·견적·도입 문의 경로", c.formCount > 0 || c.contactPageUrls.length > 0 || c.mailtoLinks.length > 0, "제안·문의 경로 있음", "제안·견적 문의 경로가 없습니다.", "사업 제안·도입 상담 폼 또는 담당자 이메일을 배치하세요.", "fail"),
      check("b2b-profile", "회사소개서·자료 다운로드", has(ctx, /소개서|제안서|브로슈어|다운로드|자료실/), "소개 자료 신호 감지", "회사소개서 다운로드가 확인되지 않습니다.", "PDF 소개서를 제공해 내부 보고를 돕게 하세요."),
      check("b2b-scope", "서비스 범위·수행 방식", has(ctx, /프로세스|수행\s?방식|서비스\s?범위|절차/), "수행 방식 안내 감지", "서비스 범위·수행 방식이 확인되지 않습니다.", "수행 프로세스를 단계별로 설명하세요."),
    ];
  },
  b2g: (ctx) => {
    const c = conv(ctx.signals);
    return [
      check("b2g-capability", "공공 과제·수행 역량", has(ctx, /공공|지자체|정부|정책|위탁|용역/), "공공 사업 수행 메시지 감지", "공공 과제 수행 역량이 명확하지 않습니다.", "공공기관 담당자가 확인할 수행 역량을 명시하세요."),
      check("b2g-record", "수행 사업 사례·발주기관", has(ctx, /수행|발주|사업\s?실적|협약|성과/), "수행 실적 신호 감지", "수행 사업 실적이 확인되지 않습니다.", "발주기관·기간·성과를 정리한 실적 페이지를 만드세요."),
      check("b2g-cert", "인증·등록·법인 정보", has(ctx, /사업자|법인|인증|등록|고유번호/), "법인·인증 정보 감지", "법인·인증 정보가 확인되지 않습니다.", "사업자 정보와 관련 인증을 푸터에 명시하세요."),
      hardCheck("b2g-inquiry", "제안·협력·용역 문의 경로", c.formCount > 0 || c.contactPageUrls.length > 0 || c.mailtoLinks.length > 0, "협력 문의 경로 있음", "제안·협력 문의 경로가 없습니다.", "사업 제안·용역 문의 창구를 명시하세요.", "fail"),
      check("b2g-privacy", "접근성·개인정보·공공 신뢰", ctx.signals.hasPrivacy, "정책 페이지 있음", "개인정보·정책 페이지가 확인되지 않습니다.", "개인정보처리방침과 접근성 정책을 게시하세요."),
    ];
  },
  b2b2c: (ctx) => sharedTwoSided(ctx),
  b2g2c: (ctx) => sharedTwoSided(ctx),
  d2c_ecommerce: (ctx) => ecommerce(ctx),
  retail_ecommerce: (ctx) => ecommerce(ctx),
  saas: (ctx) => {
    const c = conv(ctx.signals);
    return [
      check("saas-value", "문제·대상·제품 가치", Boolean(ctx.signals.h1s.length && ctx.signals.description), "가치 제안 메시지 있음", "제품 가치 메시지가 부족합니다.", "누구의 어떤 문제를 해결하는지 첫 화면에 명시하세요."),
      check("saas-product", "제품 화면·기능 소개", has(ctx, /기능|스크린샷|데모|화면|연동|통합/), "기능·제품 소개 감지", "제품 기능 소개가 확인되지 않습니다.", "핵심 기능과 제품 화면을 보여주세요."),
      hardCheck("saas-trial", "무료체험·데모·가격", has(ctx, /무료\s?체험|데모|요금|가격|플랜/), "체험·가격 경로 있음", "무료체험·데모·가격 안내가 없습니다.", "무료체험 또는 데모 신청과 가격 안내를 배치하세요.", "fail"),
      check("saas-proof", "도입 사례·보안", has(ctx, /도입\s?사례|고객사|보안|개인정보|iso|인증/), "도입 사례·보안 신호 감지", "도입 사례·보안 안내가 확인되지 않습니다.", "고객 사례와 보안·개인정보 정책을 공개하세요."),
      hardCheck("saas-signup", "회원가입·온보딩", c.formCount > 0 || has(ctx, /회원가입|시작하기|sign\s?up/), "가입 경로 있음", "가입·온보딩 경로가 확인되지 않습니다.", "가입 → 첫 성공 경험까지의 온보딩을 설계하세요."),
    ];
  },
  marketplace: (ctx) => [
    check("mkt-supply", "공급자 온보딩 경로", has(ctx, /입점|파트너\s?등록|공급자|판매자/), "공급자 경로 감지", "공급자 등록 경로가 확인되지 않습니다.", "공급자·판매자 온보딩 경로를 분리해 안내하세요."),
    check("mkt-demand", "수요자 이용 경로", has(ctx, /찾기|검색|매칭|이용\s?방법/), "수요자 경로 감지", "수요자 이용 경로가 확인되지 않습니다.", "수요자용 검색·매칭 경로를 첫 화면에 배치하세요."),
    check("mkt-trust", "검증·안전·정책", has(ctx, /검증|안전|보증|환불|분쟁|수수료/), "신뢰·정책 신호 감지", "검증·안전 정책이 확인되지 않습니다.", "검증 절차와 수수료·분쟁 정책을 공개하세요."),
    { id: "mkt-liquidity", title: "유동성·활성 지표", status: "manual", detail: "매칭 활성도는 공개 화면만으로 확인할 수 없습니다.", action: "내부 지표(등록·매칭·재이용)를 직접 확인하세요." },
  ],
  membership_community: (ctx) => community(ctx),
  media_content: (ctx) => community(ctx),
  nonprofit_public_interest: (ctx) => [
    check("np-mission", "미션·대상 명확성", Boolean(ctx.signals.h1s.length) && has(ctx, /미션|비전|목적|가치/), "미션 메시지 감지", "미션·대상이 명확하지 않습니다.", "누구를 위해 무엇을 하는 조직인지 명시하세요."),
    check("np-donate", "후원·참여 경로", has(ctx, /후원|기부|참여|자원봉사/), "후원·참여 경로 감지", "후원·참여 경로가 확인되지 않습니다.", "후원·참여 버튼을 명확히 배치하세요."),
    check("np-transparency", "투명성·성과 공개", has(ctx, /연차\s?보고|재정|공시|성과|보고서/), "투명성 신호 감지", "재정·성과 공개가 확인되지 않습니다.", "연차보고서·재정 공시를 게시하세요."),
    check("np-org", "운영 주체 신뢰", ctx.signals.hasAbout, "운영 주체 소개 있음", "운영 주체 소개가 확인되지 않습니다.", "운영 조직·이사회를 소개하세요."),
  ],
};

function sharedTwoSided(ctx: Ctx): AdaptiveCheck[] {
  const c = conv(ctx.signals);
  return [
    check("2s-split", "구매자·수혜자 메시지 분리", has(ctx, /기관|기업/) && has(ctx, /참여|신청|모집/), "이중 고객 메시지 감지", "구매 기관과 참여자 메시지가 분리되어 있지 않습니다.", "첫 화면에서 기관 담당자와 참여자의 경로를 분리하세요."),
    hardCheck("2s-orgpath", "기관 제안 경로", c.formCount > 0 || c.contactPageUrls.length > 0 || c.mailtoLinks.length > 0, "기관 문의 경로 있음", "기관 제안·문의 경로가 없습니다.", "기관 담당자용 제안 문의 창구를 만드세요.", "fail"),
    hardCheck("2s-userpath", "참여자 신청 경로", has(ctx, /신청|모집|접수|지원하기/), "참여 신청 경로 감지", "참여자 신청 경로가 확인되지 않습니다.", "프로그램별 대상·자격·일정·신청 버튼을 배치하세요.", "fail"),
    check("2s-proof", "기관 성과와 참여자 경험 근거", has(ctx, /사례|성과|수기|인터뷰|후기/), "이중 근거 신호 감지", "기관 성과·참여자 경험 근거가 부족합니다.", "기관용 성과 자료와 참여자 스토리를 함께 게시하세요."),
    check("2s-external", "외부 플랫폼 이동 안내", has(ctx, /바로가기|이동|플랫폼|워크/) ? true : "not_observed", "외부 서비스 연결 안내 감지", "외부 플랫폼 이동 목적 설명이 확인되지 않습니다.", "별도 플랫폼으로 이동할 때 역할과 목적을 설명하세요."),
  ];
}

function ecommerce(ctx: Ctx): AdaptiveCheck[] {
  return [
    check("ec-discovery", "카테고리·검색·상품 발견", has(ctx, /카테고리|검색|베스트|신상품|기획전/), "상품 발견 구조 감지", "상품 발견 구조가 확인되지 않습니다.", "카테고리와 검색으로 상품을 찾는 구조를 갖추세요."),
    hardCheck("ec-cart", "장바구니·결제", has(ctx, /장바구니|결제|구매하기|주문/), "구매·결제 경로 감지", "장바구니·결제 경로가 확인되지 않습니다.", "장바구니와 결제 흐름을 점검하세요.", "fail"),
    check("ec-shipping", "배송·교환·환불 안내", has(ctx, /배송|교환|환불|반품/), "배송·환불 정책 감지", "배송·교환·환불 안내가 확인되지 않습니다.", "배송·교환·환불 정책을 상품 페이지에서 안내하세요."),
    check("ec-review", "리뷰·신뢰", has(ctx, /리뷰|상품평|후기|별점/), "리뷰 신호 감지", "상품 리뷰가 확인되지 않습니다.", "구매 리뷰를 수집·노출하세요."),
    { id: "ec-payment", title: "결제 성공률·보안", status: "manual", detail: "실제 결제 과정은 공개 화면만으로 확인할 수 없습니다.", action: "테스트 주문으로 결제·보안 흐름을 직접 확인하세요." },
  ];
}

function community(ctx: Ctx): AdaptiveCheck[] {
  return [
    check("cm-structure", "미션·대상·콘텐츠 구조", Boolean(ctx.signals.hasBlog || ctx.signals.h2s.length >= 3), "콘텐츠 구조 감지", "콘텐츠 구조가 확인되지 않습니다.", "주제별 콘텐츠 구조를 정리하세요."),
    check("cm-subscribe", "구독·회원·참여 경로", has(ctx, /구독|뉴스레터|가입|멤버십/), "구독·가입 경로 감지", "구독·가입 경로가 확인되지 않습니다.", "뉴스레터 구독 또는 멤버십 가입을 배치하세요."),
    check("cm-operator", "운영 주체·투명성", ctx.signals.hasAbout, "운영 주체 소개 있음", "운영 주체 소개가 확인되지 않습니다.", "운영 주체와 발행 원칙을 소개하세요."),
    check("cm-return", "재방문 장치", has(ctx, /알림|카카오\s?채널|팔로우|rss/) ? true : "not_observed", "재방문 장치 감지", "재방문 유도 장치가 확인되지 않습니다.", "구독·알림 등 재방문 장치를 추가하세요."),
  ];
}

export function scoreJourney(signals: ParsedSiteSignals, journey: CustomerJourney): JourneyScoreCard {
  const text = [signals.title, signals.description, ...signals.h1s, ...signals.h2s, (signals.bodyText || "").slice(0, 8000)].join(" ").toLowerCase();
  const builder = BUILDERS[journey.marketMotion];
  const checks = builder ? builder({ signals, journey, text }) : [];
  const card = computeScoreCard(`journey-${journey.id}`, journey.label, checks, "이 여정 유형의 자동 점검 항목이 부족해 서술형으로 안내합니다.");
  return { ...card, journeyId: journey.id, journeyLabel: journey.label, marketMotion: journey.marketMotion, priority: journey.priority };
}

export function scoringProfileId(primary: MarketMotion, secondary: MarketMotion[]): string {
  return ["v4", primary, ...secondary].join("+");
}
