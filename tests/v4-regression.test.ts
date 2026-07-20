/**
 * v4 필수 회귀 테스트 (PRD §21.2) — 상상우리형 B2B/B2G 혼합, 이커머스, SaaS, AI 비활성.
 * 회사명 하드코딩 금지(§24.1): 신호 픽스처로 검증한다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDiagnosis } from "../lib/analyzer";
import type { DiagnosisInput } from "../lib/types";
import type { ParsedSiteSignals } from "../lib/crawl";

// crawlAndParse를 목킹하기 위해 모듈 흉내 대신 fetchImpl 주입이 없어,
// 분류·채점·보고 조립을 signals 픽스처로 직접 검증한다.
import { classifyBusiness } from "../lib/business-classifier";
import { computeAdaptiveScores } from "../lib/scoring/adaptive-scores";
import { evaluateConversion } from "../lib/conversion-diagnosis";
import { buildSeoPlaybook } from "../lib/seo-playbook";
import { adaptKeywordStrategyForProfile } from "../lib/ai-strategy";
import { buildV4Sections } from "../lib/report-v4";
import { validateConsistency } from "../lib/diagnosis-consistency";
import { surfaceCeilings } from "../lib/score-reliability";

function sig(partial: Partial<ParsedSiteSignals>): ParsedSiteSignals {
  return {
    url: "https://example.org", hostname: "example.org", title: "기관 협력 중장년 일자리 전문기관", description: "대기업·공공기관과 함께하는 일자리·교육 사업",
    h1s: ["기관과 함께 만드는 중장년 일자리"], h2s: ["사업 소개", "수행 실적", "프로그램 모집"], canonical: "https://example.org", lang: "ko",
    hasViewport: true, hasOg: true, hasTwitterCard: false, hasJsonLd: false, hasSchemaOrg: false, hasRobotsMeta: false,
    robotsMetaContent: null, hasSitemapHint: false, hasFavicon: true, https: true, wordCount: 1500,
    bodyText: "", imageCount: 5, imagesWithAlt: 3, internalLinks: 30, externalLinks: 5, socialLinks: [],
    hasForm: false, hasCtaHints: false, hasContact: true, hasBlog: true, hasAbout: true, hasPrivacy: true,
    hasAnalyticsHints: false, hasNav: true, hasFooter: true, phones: [], pages: ["https://example.org"], pageCountCrawled: 4,
    conversion: { ctaTexts: [], telLinks: [], mailtoLinks: ["mailto:biz@example.org"], kakaoLinks: [], naverTalkLinks: [], bookingLinks: [], contactPageUrls: ["/contact"], formCount: 0 },
    ...partial,
  } as ParsedSiteSignals;
}

const B2BG_BODY = "대기업 공공기관 지자체와 함께 중장년 일자리 교육 연구 사업을 위탁 용역 수행합니다. 수행 실적 발주기관 협약 성과. 기업 교육 도입 사례 고객사. 중장년 프로그램 참여 신청 모집. 사업자 등록 인증.";

describe("v4 회귀: 상상우리형 B2B/B2G 혼합 (§21.2)", () => {
  const s = sig({ bodyText: B2BG_BODY });
  const input: DiagnosisInput = { url: s.url, company: "테스트기관" };

  it("주 모델 b2b/b2g + 보조 참여자 모델, B2C 아님", async () => {
    const p = await classifyBusiness(s, input, { aiAvailable: false });
    assert.ok(["b2b_service", "b2g"].includes(p.primaryMarketMotion));
    assert.ok(p.secondaryMarketMotions.some((m) => ["b2g", "b2b_service", "b2g2c", "b2b2c"].includes(m)));
    assert.notEqual(p.primaryMarketMotion, "b2c_service");
  });

  it("전화·카카오·예약 부재를 핵심 실패로 계산하지 않음", async () => {
    const p = await classifyBusiness(s, input, { aiAvailable: false });
    const conv = evaluateConversion(s, p);
    const tel = conv.checks.find((c) => c.id === "conversion-tel")!;
    assert.equal(tel.status, "not_applicable");
    const scores = computeAdaptiveScores(s, p);
    const primaryJourney = scores.journeyScores[0];
    assert.ok(!primaryJourney.checks.some((c) => /tel|kakao|예약/.test(c.id) && c.status === "fail"));
  });

  it("혼합·저신뢰 → 단일 확정 등급 없음 + 여정 분리", async () => {
    const p = await classifyBusiness(s, input, { aiAvailable: false });
    const scores = computeAdaptiveScores(s, p);
    assert.equal(scores.grade, null);
    assert.ok(scores.journeyScores.length >= 2);
  });

  it("B2B를 title 희석으로 권고하지 않음", async () => {
    const p = await classifyBusiness(s, input, { aiAvailable: false });
    const playbook = buildSeoPlaybook(s, { ...input, keywords: ["중장년 일자리"] }, p);
    const all = JSON.stringify(playbook);
    assert.ok(!all.includes("부가 사업은 전용 페이지 title로 분리"));
  });

  it("비용·추천·후기·신청 방법 자동 키워드 미생성", async () => {
    const p = await classifyBusiness(s, input, { aiAvailable: false });
    const strategy = adaptKeywordStrategyForProfile({
      source: "heuristic", mainBusiness: "일자리 사업", primaryService: "중장년 일자리", regions: [],
      tier1: [{ keyword: "중장년 일자리 비용", intent: "x" }], tier2: [{ keyword: "중장년 일자리 후기", intent: "x" }, { keyword: "중장년 일자리 신청 방법", intent: "x" }], tier3: [],
      titleAfter: "", metaAfter: "", h1After: "", notes: [],
    } as never, p);
    const kws = [...strategy.tier1, ...strategy.tier2, ...strategy.tier3].map((t) => t.keyword);
    assert.ok(!kws.some((k) => /(비용|추천|후기|신청\s?방법)$/.test(k)));
    assert.ok(kws.some((k) => /위탁|사례|사업|용역|협력/.test(k)));
  });

  it("보고서에 '무엇을 신청해야 하는지' 단정 없음 + 경로 분리 권고", async () => {
    const p = await classifyBusiness(s, input, { aiAvailable: false });
    const scores = computeAdaptiveScores(s, p);
    const md = buildV4Sections(p, scores, validateConsistency(p, scores, { conversionChecks: [], executiveSummary: "" }));
    assert.ok(!md.includes("무엇을 신청해야 하는지 모릅니다"));
    assert.ok(/기관|제안/.test(md));
    assert.ok(md.includes("여정별 전환 준비도"));
  });

  it("CTA·폼 부재 62점 상한이 비B2C에서 면제됨", () => {
    const capped = surfaceCeilings(s);
    const exempt = surfaceCeilings(s, { conversionCapExempt: true });
    assert.equal(capped.ceiling, 62);
    assert.notEqual(exempt.ceiling, 62);
  });
});

describe("v4 회귀: 이커머스 (§21.2)", () => {
  const s = sig({
    title: "브랜드 공식 쇼핑몰", description: "베스트 상품과 신상품",
    h1s: ["신상품 기획전"], bodyText: "카테고리 검색 베스트 상품 장바구니 결제 주문 배송 교환 환불 리뷰 상품평",
    conversion: { ctaTexts: ["구매하기"], telLinks: [], mailtoLinks: [], kakaoLinks: [], naverTalkLinks: [], bookingLinks: [], contactPageUrls: [], formCount: 0 },
  });

  it("장바구니·결제·배송·환불 평가 + 문의 폼 부재 미감점", async () => {
    const p = await classifyBusiness(s, { url: s.url }, { aiAvailable: false });
    assert.ok(["d2c_ecommerce", "retail_ecommerce"].includes(p.primaryMarketMotion));
    const scores = computeAdaptiveScores(s, p);
    const j = scores.journeyScores[0];
    assert.equal(j.checks.find((c) => c.id === "ec-cart")!.status, "pass");
    assert.ok(j.checks.find((c) => c.id === "ec-shipping"));
    const conv = evaluateConversion(s, p);
    const form = conv.checks.find((c) => c.id === "conversion-form")!;
    assert.notEqual(form.status, "fail");
  });
});

describe("v4 회귀: SaaS (§21.2)", () => {
  const s = sig({
    title: "업무 자동화 SaaS", description: "팀을 위한 자동화 도구",
    h1s: ["업무 자동화를 시작하세요"], bodyText: "무료 체험 데모 신청 요금제 플랜 기능 연동 API 보안 도입 사례 고객사 회원가입 시작하기 온보딩",
  });

  it("데모·무료체험·가격·보안·사례 평가, 카카오·지역 SEO 비필수", async () => {
    const p = await classifyBusiness(s, { url: s.url }, { aiAvailable: false });
    assert.equal(p.primaryMarketMotion, "saas");
    const scores = computeAdaptiveScores(s, p);
    const j = scores.journeyScores[0];
    assert.equal(j.checks.find((c) => c.id === "saas-trial")!.status, "pass");
    assert.ok(!j.checks.some((c) => /kakao|지역/.test(c.id)));
    const conv = evaluateConversion(s, p);
    assert.equal(conv.checks.find((c) => c.id === "conversion-tel")!.status, "not_applicable");
  });
});

describe("v4 회귀: AI 비활성 폴백 (§21.2, §18.2)", () => {
  it("B2C로 강제 폴백하지 않고 낮은 신뢰도·임시 진단 표시", async () => {
    const s = sig({ title: "회사", description: null, h1s: [], h2s: [], bodyText: "환영합니다", hasAbout: false, hasPrivacy: false });
    const p = await classifyBusiness(s, { url: s.url }, { aiAvailable: false });
    assert.equal(p.primaryMarketMotion, "unknown");
    assert.equal(p.confidenceLabel, "low");
    assert.equal(p.needsConfirmation, true);
    const scores = computeAdaptiveScores(s, p);
    assert.equal(scores.grade, null);
    assert.equal(scores.provisional, true);
    // 규칙 기반 공통 점검은 정상 작동
    assert.ok(scores.coreReadiness.checks.length >= 5);
  });
});
