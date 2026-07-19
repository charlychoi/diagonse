import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyBusiness, classifyHeuristically, applyOverride } from "../lib/business-classifier";
import { parseBusinessProfileJson, applyEvidenceRules, confidenceLabelOf } from "../lib/business-profile-validator";
import type { ParsedSiteSignals } from "../lib/crawl";

function sig(partial: Partial<ParsedSiteSignals>): ParsedSiteSignals {
  return {
    url: "https://example.com", hostname: "example.com", title: null, description: null,
    h1s: [], h2s: [], canonical: null, lang: null, hasViewport: true, hasOg: false,
    hasTwitterCard: false, hasJsonLd: false, hasSchemaOrg: false, hasRobotsMeta: false,
    robotsMetaContent: null, hasSitemapHint: false, hasFavicon: false, https: true,
    wordCount: 500, bodyText: "", imageCount: 0, imagesWithAlt: 0, internalLinks: 10,
    externalLinks: 2, socialLinks: [], hasForm: false, hasCtaHints: false, hasContact: false,
    hasBlog: false, hasAbout: true, hasPrivacy: false, hasAnalyticsHints: false,
    hasNav: true, hasFooter: true, pages: ["https://example.com"], pageCountCrawled: 1,
    ...partial,
  } as ParsedSiteSignals;
}

describe("classifyHeuristically", () => {
  it("detects ecommerce from cart/checkout signals", () => {
    const p = classifyHeuristically(sig({ bodyText: "베스트 상품 장바구니 담기 결제 배송 안내 교환·환불 정책" }), { url: "https://shop.example.com" });
    assert.equal(p.primaryMarketMotion, "retail_ecommerce");
    assert.equal(p.source, "heuristic");
    assert.equal(p.needsConfirmation, true);
  });

  it("detects b2b/b2g mix and never defaults to b2c", () => {
    const p = classifyHeuristically(sig({ bodyText: "공공기관 위탁 용역 수행, 기업 교육과 도입 사례, 중장년 프로그램 참여 신청 모집" }), { url: "https://org.example.com" });
    assert.equal(p.primaryMarketMotion, "b2g");
    assert.ok(p.secondaryMarketMotions.includes("b2b_service"));
    assert.notEqual(p.primaryMarketMotion, "b2c_service");
    assert.ok(p.journeys.length >= 2);
    assert.equal(p.journeys[0].objective, "request_proposal");
  });

  it("returns unknown with low confidence when no signals", () => {
    const p = classifyHeuristically(sig({ bodyText: "환영합니다" }), { url: "https://blank.example.com" });
    assert.equal(p.primaryMarketMotion, "unknown");
    assert.equal(p.confidenceLabel, "low");
  });
});

describe("parseBusinessProfileJson + confidence rules", () => {
  const sangsangwooriJson = JSON.stringify({
    primaryMarketMotion: "b2b_service",
    secondaryMarketMotions: ["b2g", "b2g2c"],
    revenueMotions: ["project_contract", "public_procurement"],
    audiences: [
      { id: "a1", label: "기업·공공기관 담당자", roles: ["economicBuyer", "decisionMaker"], needs: ["중장년 일자리 사업 수행"], expectedProof: ["수행 사례"] },
      { id: "a2", label: "중장년 참여자", roles: ["endUser", "beneficiary"], needs: ["프로그램 참여"], expectedProof: ["모집 공고"] },
    ],
    journeys: [
      { id: "j1", label: "기관 사업 제안", audienceId: "a1", marketMotion: "b2b_service", objective: "request_proposal", priority: "primary", buyingCycle: "procurement", expectedCtas: ["사업 제안 문의"], expectedEvidence: ["사업 사례"] },
      { id: "j2", label: "프로그램 참여", audienceId: "a2", marketMotion: "b2g2c", objective: "apply_program", priority: "secondary", buyingCycle: "short", expectedCtas: ["신청"], expectedEvidence: ["모집 요강"] },
    ],
    evidence: [
      { claim: "대기업·공공기관 협력 사업 수행", evidenceText: "삼성·고용노동부와 함께한 중장년 일자리 사업", sourceUrl: "https://example.org/business", sourceType: "service_page", strength: "strong" },
      { claim: "중장년 대상 프로그램 모집", evidenceText: "OO 프로그램 참여자 모집", sourceUrl: "https://example.org/program", sourceType: "service_page", strength: "strong" },
    ],
    alternativeHypotheses: [{ marketMotion: "b2g", reason: "공공 위탁 비중이 더 클 수 있음" }],
    confidence: 0.9,
  });

  it("parses Sangsangwoori-like profile with buyer/beneficiary separation", () => {
    const p = parseBusinessProfileJson(sangsangwooriJson, { source: "ai_web", pagesCrawled: 5 });
    assert.ok(p);
    assert.equal(p!.primaryMarketMotion, "b2b_service");
    assert.deepEqual(p!.secondaryMarketMotions, ["b2g", "b2g2c"]);
    assert.equal(p!.isHybrid, true);
    assert.equal(p!.confidenceLabel, "high");
    assert.equal(p!.needsConfirmation, false);
    assert.equal(p!.audiences.length, 2);
    assert.equal(p!.primaryObjectiveId, "j1");
  });

  it("caps confidence without strong evidence (§10.3)", () => {
    assert.ok(applyEvidenceRules(0.95, [], 1) <= 0.64);
    assert.equal(confidenceLabelOf(0.64), "low");
    assert.equal(confidenceLabelOf(0.7), "medium");
  });

  it("returns null on invalid JSON", () => {
    assert.equal(parseBusinessProfileJson("not json", { source: "ai_web", pagesCrawled: 1 }), null);
  });
});

describe("classifyBusiness (AI path mocked)", () => {
  it("uses AI JSON and builds journeys; falls back to heuristic on bad output", async () => {
    const aiCall = (async () => ({ provider: "openai", model: "gpt-5.6", output: '{"primaryMarketMotion":"saas","secondaryMarketMotions":[],"revenueMotions":["subscription"],"audiences":[],"journeys":[],"evidence":[{"claim":"c","evidenceText":"e","sourceUrl":"https://x","sourceType":"homepage","strength":"strong"},{"claim":"c2","evidenceText":"e2","sourceUrl":"https://x","sourceType":"homepage","strength":"strong"}],"alternativeHypotheses":[],"confidence":0.85}', citations: [] })) as never;
    const p = await classifyBusiness(sig({ pageCountCrawled: 4 }), { url: "https://saas.example.com" }, { aiCall, aiAvailable: true });
    assert.equal(p.primaryMarketMotion, "saas");
    assert.equal(p.source, "ai_web");
    assert.equal(p.journeys[0].objective, "start_trial");

    const badCall = (async () => ({ provider: "openai", model: "gpt-5.6", output: "oops", citations: [] })) as never;
    const f = await classifyBusiness(sig({ bodyText: "장바구니 결제 배송" }), { url: "https://shop.example.com" }, { aiCall: badCall, aiAvailable: true });
    assert.equal(f.source, "heuristic");
    assert.equal(f.primaryMarketMotion, "retail_ecommerce");
  });

  it("applyOverride sets user_override and rebuilds journeys", () => {
    const base = classifyHeuristically(sig({}), { url: "https://x.example.com" });
    const p = applyOverride(base, { primaryMarketMotion: "b2b_service" });
    assert.equal(p.source, "user_override");
    assert.equal(p.needsConfirmation, false);
    assert.equal(p.journeys[0].marketMotion, "b2b_service");
  });
});
