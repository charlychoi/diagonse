import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { evaluateAiPrecheck } from "../lib/ai-precheck";
import type { ParsedSiteSignals } from "../lib/crawl";

function sig(): ParsedSiteSignals {
  return {
    url: "https://theserveon.com/", hostname: "theserveon.com", title: "서브온", description: "병원동행",
    h1s: ["서브온 병원동행"], h2s: [], canonical: null, lang: "ko", hasViewport: true, hasOg: true,
    hasTwitterCard: false, hasJsonLd: false, hasSchemaOrg: false, hasRobotsMeta: false, robotsMetaContent: null,
    hasSitemapHint: false, hasFavicon: true, https: true, wordCount: 400, bodyText: "병원동행 서비스 상담",
    imageCount: 3, imagesWithAlt: 2, internalLinks: 8, externalLinks: 2, socialLinks: [], hasForm: true,
    hasCtaHints: true, hasContact: true, hasBlog: false, hasAbout: true, hasPrivacy: true, hasAnalyticsHints: false,
    hasNav: true, hasFooter: true, schemaTypes: [], phones: [], addressHints: [], hasReviewSignal: false,
    hasMapEmbed: false, hasHours: false, pageCountCrawled: 1, pages: ["https://theserveon.com/"],
    rawSnippets: { title: null, description: null, firstH1: null },
  } as unknown as ParsedSiteSignals;
}
const ctx = {
  hero: { score: 60 } as never, conversion: { score: 55 } as never,
  adReadiness: { score: 50, level: "주의" } as never, servicePages: { summary: "서비스 페이지 1개" } as never,
};

// fake Anthropic response containing our required JSON
function fakeAnthropic(json: object): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(json) }] }), { status: 200 })) as unknown as typeof fetch;
}

afterEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.AI_MODE; delete process.env.XAI_API_KEY; });

describe("evaluateAiPrecheck — 공개(Claude) 경로 (mock)", () => {
  it("AI 응답에서 요약·우선순위·경쟁사·googlePresence를 파싱한다", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const fetchImpl = fakeAnthropic({
      summary: "광고 전 첫화면 메시지와 전환 경로를 먼저 보강해야 합니다.",
      priorities: [{ title: "H1에 서비스 명시", reason: "회사명만 노출", action: "H1을 '서브온 병원동행'으로", impact: "high" }],
      messaging: { headline: "서브온 병원동행", subcopy: "접수부터 귀가까지", primaryCta: "상담 신청" },
      competitorCandidates: [{ name: "고위드유", url: "https://gowithyou.example", reason: "동일 병원동행", confidence: "medium" }],
      googlePresence: { status: "present", detail: "구글에서 '서브온' 검색 시 지도 패널 노출", guidance: "리뷰 20개+ 확보로 안정화" },
    });
    const r = await evaluateAiPrecheck(sig(), { url: "https://theserveon.com/", company: "서브온", keywords: ["병원동행"] }, ctx, { fetchImpl });
    assert.equal(r.enabled, true);
    assert.equal(r.provider, "anthropic");
    assert.equal(r.priorities.length, 1);
    assert.equal(r.competitorCandidates[0].name, "고위드유");
    assert.ok(r.googlePresence);
    assert.equal(r.googlePresence?.status, "present");
    assert.ok(r.messaging?.headline.includes("병원동행"));
  });

  it("키가 없으면 enabled=false (규칙 폴백)", async () => {
    const r = await evaluateAiPrecheck(sig(), { url: "https://theserveon.com/", company: "서브온" }, ctx);
    assert.equal(r.enabled, false);
    assert.equal(r.provider, "none");
  });
});
