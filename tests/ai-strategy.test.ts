import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHeuristicStrategy,
  buildKeywordStrategy,
  extractContentKeywords,
  extractRegions,
  parseStrategyJson,
  buildFaqJsonLd,
} from "../lib/ai-strategy";
import type { ParsedSiteSignals } from "../lib/crawl";

function fakeSignals(over: Partial<ParsedSiteSignals> = {}): ParsedSiteSignals {
  return {
    url: "https://example.com",
    hostname: "example.com",
    title: "행복동행 | 병원동행 전문 서비스",
    description: "부모님 병원동행, 검사 동행을 지원하는 병원동행 전문 서비스",
    h1s: ["행복동행 병원동행 서비스"],
    h2s: ["수면내시경 보호자 동행", "입퇴원 동행", "치매검사 동행"],
    canonical: null, lang: "ko", hasViewport: true, hasOg: false,
    hasTwitterCard: false, hasJsonLd: false, hasSchemaOrg: false,
    hasRobotsMeta: false, robotsMetaContent: null, hasSitemapHint: false,
    hasFavicon: false, https: true, wordCount: 500,
    bodyText:
      "행복동행은 부모님 병원동행 전문 서비스입니다. 수면내시경 보호자 동행, 치매검사 동행, 입퇴원 동행을 서울 서초구 강남구에서 제공합니다. 병원 접수부터 진료 검사 수납 귀가까지 함께합니다.",
    imageCount: 0, imagesWithAlt: 0, internalLinks: 5, externalLinks: 1,
    socialLinks: [], hasForm: true, hasCtaHints: true, hasContact: true,
    hasBlog: false, hasAbout: true, hasPrivacy: true, hasAnalyticsHints: false,
    hasNav: true, hasFooter: true, pageCountCrawled: 1,
    pages: ["https://example.com"],
    rawSnippets: { title: null, description: null, firstH1: null },
    ...over,
  };
}

describe("extractContentKeywords", () => {
  it("mines non-brand keywords from crawled content", () => {
    const s = fakeSignals();
    const kws = extractContentKeywords(s, s.bodyText, "행복동행");
    assert.ok(kws.length >= 5, `expected >=5 keywords, got ${kws.length}`);
    assert.ok(!kws.some((k) => k.includes("행복동행")), "brand must be excluded");
    assert.ok(
      kws.some((k) => k.includes("병원동행") || k.includes("동행")),
      "should surface main business terms",
    );
  });
});

describe("extractRegions", () => {
  it("detects region tokens", () => {
    const r = extractRegions("서울 서초구 강남구에서 서비스 제공");
    assert.ok(r.length >= 1);
    assert.ok(r.some((x) => /서초구|강남구|서울/.test(x)));
  });
});

describe("buildHeuristicStrategy (no API key)", () => {
  it("never uses company name as a keyword; builds 3-tier strategy", () => {
    const s = fakeSignals();
    const st = buildHeuristicStrategy(s, { url: s.url, company: "행복동행" }, s.bodyText);
    assert.equal(st.source, "heuristic");
    assert.ok(st.primaryService && st.primaryService !== "핵심 서비스");
    const all = [...st.tier1, ...st.tier2, ...st.tier3].map((t) => t.keyword);
    assert.ok(all.length >= 6, "tiers should have keywords");
    assert.ok(
      !all.some((k) => k === "행복동행"),
      "brand name alone must not be a strategy keyword",
    );
    assert.ok(st.titleAfter.includes(st.primaryService), "titleAfter contains service");
    assert.ok(st.faqs.length >= 3 && st.blogTitles.length >= 3);
  });

  it("falls back gracefully when title/desc missing (URL+company only)", () => {
    const s = fakeSignals({ title: null, description: null, h1s: [], h2s: [] });
    const st = buildHeuristicStrategy(s, { url: s.url, company: "행복동행" }, s.bodyText);
    // body text mining should still find the main business
    assert.ok(st.primaryService !== "핵심 서비스", `got placeholder: ${st.primaryService}`);
  });
});

describe("buildKeywordStrategy", () => {
  it("uses heuristic mode without ANTHROPIC_API_KEY", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const s = fakeSignals();
    const st = await buildKeywordStrategy(s, { url: s.url, company: "행복동행" }, s.bodyText);
    assert.equal(st.source, "heuristic");
  });
});

describe("parseStrategyJson", () => {
  it("parses fenced JSON from model output", () => {
    const out = parseStrategyJson(
      '```json\n{"mainBusiness":"병원동행","primaryService":"병원동행","tier1":[{"keyword":"병원동행 서비스","intent":"전환"}],"tier2":[{"keyword":"수면내시경 보호자","intent":"상황"}],"tier3":[],"titleAfter":"A | B","metaAfter":"m","h1After":"h","faqs":[{"q":"q1","a":"a1"}],"blogTitles":["t1"],"notes":[]}\n```',
    );
    assert.ok(out);
    assert.equal(out!.primaryService, "병원동행");
    assert.equal(out!.tier2[0].keyword, "수면내시경 보호자");
  });
  it("returns null on garbage", () => {
    assert.equal(parseStrategyJson("죄송합니다, JSON을 만들 수 없습니다"), null);
  });
});

describe("buildFaqJsonLd", () => {
  it("emits valid FAQPage schema", () => {
    const ld = JSON.parse(buildFaqJsonLd([{ q: "질문", a: "답변" }]));
    assert.equal(ld["@type"], "FAQPage");
    assert.equal(ld.mainEntity[0].name, "질문");
  });
});

describe("tech-artifact filtering (regression: sangsangwoori 'hover' bug)", () => {
  it("excludes CSS/HTML/JS tokens from mined keywords", () => {
    const polluted = fakeSignals({
      title: "상상우리",
      description: "중장년의 경험과 지혜가 사회혁신의 자원이 되도록",
      h1s: [],
      h2s: [],
      bodyText:
        "hover text img viewport nav show button click div span 상상우리는 중장년 일자리와 사회공헌 교육 컨설팅을 제공합니다. 시니어 컨설팅 사회공헌 프로그램 교육 hover text img nav",
    });
    const kws = extractContentKeywords(polluted, polluted.bodyText, "상상우리");
    const junk = ["hover", "text", "img", "viewport", "nav", "show", "button", "click"];
    assert.ok(
      !kws.some((k) => junk.includes(k)),
      `tech tokens leaked: ${kws.filter((k) => junk.includes(k)).join(", ")}`,
    );
    assert.ok(
      kws.some((k) => /[가-힣]/.test(k)),
      "should keep Korean business keywords",
    );
  });

  it("primaryService is a Korean business term, never a CSS token", () => {
    const polluted = fakeSignals({
      title: "상상우리",
      description: "중장년 시니어 컨설팅 교육",
      h1s: [],
      h2s: [],
      bodyText: "hover text img nav 시니어 컨설팅 교육 사회공헌 중장년 일자리 컨설팅 교육",
    });
    const st = buildHeuristicStrategy(polluted, { url: polluted.url, company: "상상우리" }, polluted.bodyText);
    assert.ok(/[가-힣]/.test(st.primaryService), `service not Korean: ${st.primaryService}`);
    assert.ok(
      !["hover", "text", "img", "nav", "viewport"].includes(st.primaryService),
      `service is a tech token: ${st.primaryService}`,
    );
    const tier2 = st.tier2.map((x) => x.keyword);
    assert.ok(
      !tier2.some((k) => ["hover", "text", "img", "nav", "viewport", "show"].includes(k)),
      `tier2 has tech tokens: ${tier2.join(", ")}`,
    );
  });
});
