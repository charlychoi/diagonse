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
