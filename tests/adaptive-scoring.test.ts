import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeScoreCard, shouldHideCard } from "../lib/scoring/journey-score";
import { computeAdaptiveScores } from "../lib/scoring/adaptive-scores";
import { scoreJourney } from "../lib/scoring/profile-registry";
import { classifyHeuristically } from "../lib/business-classifier";
import type { AdaptiveCheck } from "../lib/business-profile-types";
import type { ParsedSiteSignals } from "../lib/crawl";

function sig(partial: Partial<ParsedSiteSignals>): ParsedSiteSignals {
  return {
    url: "https://example.com", hostname: "example.com", title: "테스트 회사 | 서비스", description: "설명",
    h1s: ["헤드라인"], h2s: ["소개", "사업", "문의"], canonical: "https://example.com", lang: "ko",
    hasViewport: true, hasOg: true, hasTwitterCard: false, hasJsonLd: false, hasSchemaOrg: false,
    hasRobotsMeta: false, robotsMetaContent: null, hasSitemapHint: false, hasFavicon: true, https: true,
    wordCount: 900, bodyText: "", imageCount: 3, imagesWithAlt: 2, internalLinks: 20, externalLinks: 3,
    socialLinks: [], hasForm: false, hasCtaHints: false, hasContact: true, hasBlog: false, hasAbout: true,
    hasPrivacy: true, hasAnalyticsHints: false, hasNav: true, hasFooter: true,
    pages: ["https://example.com"], pageCountCrawled: 3,
    conversion: { ctaTexts: [], telLinks: [], mailtoLinks: [], kakaoLinks: [], naverTalkLinks: [], bookingLinks: [], contactPageUrls: [], formCount: 0 },
    ...partial,
  } as ParsedSiteSignals;
}

describe("computeScoreCard — N/A 처리 (§11.3)", () => {
  const mk = (status: AdaptiveCheck["status"], i: number): AdaptiveCheck => ({ id: `c${i}`, title: `t${i}`, status, detail: "", action: "" });

  it("excludes not_applicable and manual from denominator", () => {
    const card = computeScoreCard("x", "X", [mk("pass", 1), mk("pass", 2), mk("fail", 3), mk("not_applicable", 4), mk("manual", 5)]);
    assert.equal(card.applicableCount, 3);
    assert.equal(card.naCount, 2);
    assert.equal(card.score, Math.round((2 / 3) * 100));
  });

  it("returns null score when applicable < 3 (서술형 대체)", () => {
    const card = computeScoreCard("x", "X", [mk("pass", 1), mk("not_applicable", 2), mk("not_applicable", 3), mk("not_applicable", 4)]);
    assert.equal(card.score, null);
    assert.ok(card.narrative.length > 0);
    assert.equal(shouldHideCard(card), true);
  });

  it("not_observed is not an automatic failure", () => {
    const withFail = computeScoreCard("x", "X", [mk("fail", 1), mk("pass", 2), mk("pass", 3)]);
    const withNo = computeScoreCard("x", "X", [mk("not_observed", 1), mk("pass", 2), mk("pass", 3)]);
    assert.ok(withNo.score! > withFail.score!);
  });
});

describe("profile-specific journey scoring (§11.2)", () => {
  it("ecommerce: no penalty for missing contact form; cart is checked", () => {
    const s = sig({ bodyText: "카테고리 베스트 상품 장바구니 결제 배송 교환 환불 리뷰" });
    const profile = classifyHeuristically(s, { url: s.url });
    const card = scoreJourney(s, profile.journeys[0]);
    assert.equal(card.marketMotion, "retail_ecommerce");
    assert.ok(!card.checks.some((c) => c.id.includes("form")));
    assert.equal(card.checks.find((c) => c.id === "ec-cart")!.status, "pass");
    assert.ok(card.score! >= 75);
  });

  it("b2g: tel/kakao absence is not evaluated; proposal path is", () => {
    const s = sig({ bodyText: "공공기관 지자체 위탁 용역 수행 실적 발주 사업자 등록 인증", conversion: { ctaTexts: [], telLinks: [], mailtoLinks: ["mailto:biz@x.com"], kakaoLinks: [], naverTalkLinks: [], bookingLinks: [], contactPageUrls: [], formCount: 0 } });
    const profile = classifyHeuristically(s, { url: s.url });
    assert.equal(profile.primaryMarketMotion, "b2g");
    const card = scoreJourney(s, profile.journeys[0]);
    assert.ok(!card.checks.some((c) => /tel|kakao|예약/.test(c.id + c.title)));
    assert.equal(card.checks.find((c) => c.id === "b2g-inquiry")!.status, "pass");
  });
});

describe("computeAdaptiveScores (§11.4)", () => {
  it("hybrid profile → no single overall grade; journey scores separated", () => {
    const s = sig({ bodyText: "공공기관 위탁 용역 기업 교육 도입 사례 프로그램 참여 신청 모집 수행 실적" });
    const profile = classifyHeuristically(s, { url: s.url });
    const scores = computeAdaptiveScores(s, profile);
    assert.equal(scores.overallScore, null);
    assert.equal(scores.grade, null);
    assert.equal(scores.provisional, true);
    assert.ok(scores.journeyScores.length >= 2);
  });

  it("high-confidence single journey → core 50% + journey 50%", () => {
    const s = sig({ bodyText: "무료체험 데모 요금제 기능 연동 보안 도입 사례 회원가입 시작하기" });
    const profile = { ...classifyHeuristically(s, { url: s.url }), confidence: 0.85, confidenceLabel: "high" as const, needsConfirmation: false, secondaryMarketMotions: [], isHybrid: false };
    const scores = computeAdaptiveScores(s, profile);
    assert.equal(scores.provisional, false);
    assert.ok(scores.overallScore !== null);
    assert.equal(scores.overallScore, Math.round((scores.coreReadiness.score! + scores.primaryJourneyScore!) / 2));
    assert.ok(scores.grade);
  });
});
