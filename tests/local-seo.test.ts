import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateLocalSeo, formatLocalSeoMarkdown } from "../lib/local-seo";
import type { ParsedSiteSignals } from "../lib/crawl";

function sig(over: Partial<ParsedSiteSignals> = {}): ParsedSiteSignals {
  return {
    url: "https://example.com/", hostname: "example.com",
    title: "행복동행", description: "부모님 병원동행", h1s: [], h2s: [],
    canonical: null, lang: "ko", hasViewport: true, hasOg: true, hasTwitterCard: false,
    hasJsonLd: false, hasSchemaOrg: false, hasRobotsMeta: false, robotsMetaContent: null,
    hasSitemapHint: false, hasFavicon: true, https: true, wordCount: 300, bodyText: "병원동행 서비스",
    imageCount: 3, imagesWithAlt: 2, internalLinks: 8, externalLinks: 2,
    socialLinks: ["instagram.com", "blog.naver.com"], hasForm: true, hasCtaHints: true,
    hasContact: true, hasBlog: false, hasAbout: true, hasPrivacy: true, hasAnalyticsHints: false,
    hasNav: true, hasFooter: true,
    schemaTypes: [], phones: [], addressHints: [], hasReviewSignal: false, hasMapEmbed: false, hasHours: false,
    pageCountCrawled: 1, pages: ["https://example.com/"],
    rawSnippets: { title: null, description: null, firstH1: null },
    ...over,
  };
}

describe("evaluateLocalSeo — Google Business Profile / local SEO", () => {
  it("flags missing schema/NAP and produces a panel plan + JSON-LD", () => {
    const r = evaluateLocalSeo(sig(), { url: "https://example.com/", company: "행복동행", keywords: ["병원동행"] });
    assert.ok(r.score >= 0 && r.score <= 100);
    assert.equal(r.hasOrgSchema, false);
    assert.equal(r.hasLocalBusinessSchema, false);
    assert.ok(r.items.some((i) => i.id === "gbp-exists" && i.status === "manual"), "GBP existence is manual-check");
    assert.ok(r.panelPlan.length >= 5, "should give a step-by-step panel plan");
    const org = JSON.parse(r.organizationJsonLd);
    assert.equal(org["@type"], "Organization");
    assert.equal(org.name, "행복동행");
    const lb = JSON.parse(r.localBusinessJsonLd);
    assert.equal(lb["@type"], "LocalBusiness");
    assert.ok(r.verifyLinks.some((v) => v.url.includes("business.google.com")));
  });

  it("detects NAP + schema when present and scores higher", () => {
    const withNap = evaluateLocalSeo(
      sig({
        phones: ["1533-1683"],
        addressHints: ["서울 서초구 서초중앙로 20"],
        schemaTypes: ["Organization", "LocalBusiness"],
        hasReviewSignal: true, hasMapEmbed: true, hasHours: true,
      }),
      { url: "https://example.com/", company: "행복동행", keywords: ["병원동행"] },
    );
    const without = evaluateLocalSeo(sig(), { url: "https://example.com/", company: "행복동행", keywords: ["병원동행"] });
    assert.ok(withNap.hasOrgSchema && withNap.hasLocalBusinessSchema);
    assert.ok(withNap.nap.phones.includes("1533-1683"));
    assert.ok(withNap.score > without.score, `${withNap.score} should beat ${without.score}`);
  });

  it("markdown includes panel strategy and JSON-LD", () => {
    const r = evaluateLocalSeo(sig(), { url: "https://example.com/", company: "행복동행" });
    const md = formatLocalSeoMarkdown(r);
    assert.ok(md.includes("지도·지식 패널"));
    assert.ok(md.includes("LocalBusiness"));
    assert.ok(md.includes("business.google.com"));
  });
});

describe("live Google Maps verification (no key → honest fallback)", () => {
  it("without places result → liveSearch not performed, gbp status manual", () => {
    const r = evaluateLocalSeo(sig(), { url: "https://example.com/", company: "행복동행", keywords: ["병원동행"] });
    assert.equal(r.liveSearch.performed, false);
    assert.ok(r.liveSearch.summary.length > 0);
    const gbp = r.items.find((i) => i.id === "gbp-exists");
    assert.equal(gbp?.status, "manual");
  });

  it("with places FOUND → gbp ok, uses real rating/reviews, optimization plan", () => {
    const places = {
      performed: true, method: "google_places" as const, found: true, candidates: 1, query: "행복동행",
      match: {
        name: "행복동행", address: "서울 서초구 서초중앙로 20", phone: "1533-1683",
        rating: 4.6, reviewCount: 37, businessStatus: "OPERATIONAL",
        mapsUri: "https://maps.google.com/?cid=1", websiteUri: "https://example.com/",
        primaryType: "간병 서비스", confidence: "high" as const,
      },
    };
    const r = evaluateLocalSeo(sig({ phones: ["1533-1683"] }), { url: "https://example.com/", company: "행복동행", keywords: ["병원동행"] }, places);
    assert.equal(r.liveSearch.found, true);
    assert.ok(r.liveSearch.summary.includes("등록"));
    const gbp = r.items.find((i) => i.id === "gbp-exists");
    assert.equal(gbp?.status, "ok");
    const rev = r.items.find((i) => i.id === "reviews");
    assert.equal(rev?.status, "ok");
    assert.ok(rev?.detail.includes("37"));
    assert.ok(r.panelPlan[0].step.includes("최적화") || r.panelPlan[0].step.includes("노출 중"));
  });

  it("with places NOT FOUND → gbp missing, registration-first plan", () => {
    const places = {
      performed: true, method: "google_places" as const, found: false, candidates: 0, query: "행복동행", match: null,
    };
    const r = evaluateLocalSeo(sig(), { url: "https://example.com/", company: "행복동행", keywords: ["병원동행"] }, places);
    const gbp = r.items.find((i) => i.id === "gbp-exists");
    assert.equal(gbp?.status, "missing");
    assert.ok(r.panelPlan[0].step.includes("미노출") || r.panelPlan[0].step.includes("등록"));
  });
});
