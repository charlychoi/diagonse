/** v4.1 사전진단 극대화 테스트 — 사회적기업 프로필 · AI 품질 패스 · 실측 필드 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyHeuristically } from "../lib/business-classifier";
import { computeAdaptiveScores } from "../lib/scoring/adaptive-scores";
import { evaluateConversion } from "../lib/conversion-diagnosis";
import { adaptKeywordStrategyForProfile } from "../lib/ai-strategy";
import { runPrevisitQualityPass } from "../lib/previsit-quality";
import { buildBriefMarkdown, buildEasyMarkdown } from "../lib/previsit-markdown";
import { computeCoreReadiness } from "../lib/scoring/common-score";
import type { ParsedSiteSignals } from "../lib/crawl";
import type { DiagnosisResult } from "../lib/types";

function sig(partial: Partial<ParsedSiteSignals>): ParsedSiteSignals {
  return {
    url: "https://se.example.org", hostname: "se.example.org", title: "사회적기업 테스트", description: "취약계층 고용 사회적기업",
    h1s: ["함께 만드는 가치"], h2s: ["제품", "성과", "협력"], canonical: null, lang: "ko", hasViewport: true, hasOg: true,
    hasTwitterCard: false, hasJsonLd: false, hasSchemaOrg: false, hasRobotsMeta: false, robotsMetaContent: null,
    hasSitemapHint: false, hasFavicon: true, https: true, wordCount: 800, bodyText: "", imageCount: 2, imagesWithAlt: 1,
    internalLinks: 15, externalLinks: 2, socialLinks: [], hasForm: true, hasCtaHints: true, hasContact: true,
    hasBlog: false, hasAbout: true, hasPrivacy: true, hasAnalyticsHints: false, hasNav: true, hasFooter: true,
    phones: [], pages: ["https://se.example.org"], pageCountCrawled: 3,
    conversion: { ctaTexts: ["문의하기"], telLinks: [], mailtoLinks: ["mailto:hello@se.org"], kakaoLinks: [], naverTalkLinks: [], bookingLinks: [], contactPageUrls: ["/contact"], formCount: 1 },
    ...partial,
  } as ParsedSiteSignals;
}

const SE_BODY = "고용노동부 인증 사회적기업으로 취약계층 고용과 사회적 가치를 실현합니다. 나라장터 조달 등록, 공공기관 납품 실적, 사회 성과 연차 보고. 제품 구매는 스토어에서. 프로그램 참여 신청 모집.";

describe("v4.1 사회적기업 프로필", () => {
  it("사회적기업 신호를 최우선 분류", () => {
    const p = classifyHeuristically(sig({ bodyText: SE_BODY }), { url: "https://se.example.org" });
    assert.equal(p.primaryMarketMotion, "social_enterprise");
    assert.equal(p.journeys[0].marketMotion, "social_enterprise");
  });

  it("인증·임팩트·공공구매·시장매출 채점 + 균형은 직접 확인", () => {
    const s = sig({ bodyText: SE_BODY });
    const p = classifyHeuristically(s, { url: s.url });
    const scores = computeAdaptiveScores(s, p);
    const j = scores.journeyScores.find((x) => x.marketMotion === "social_enterprise")!;
    assert.equal(j.checks.find((c) => c.id === "se-cert")!.status, "pass");
    assert.equal(j.checks.find((c) => c.id === "se-impact")!.status, "pass");
    assert.equal(j.checks.find((c) => c.id === "se-procure")!.status, "pass");
    assert.equal(j.checks.find((c) => c.id === "se-balance")!.status, "manual");
  });

  it("전화 부재 N/A + 사회적기업 키워드 의도", () => {
    const s = sig({ bodyText: SE_BODY });
    const p = classifyHeuristically(s, { url: s.url });
    const conv = evaluateConversion(s, p);
    assert.equal(conv.checks.find((c) => c.id === "conversion-tel")!.status, "not_applicable");
    const st = adaptKeywordStrategyForProfile({ source: "heuristic", mainBusiness: "", primaryService: "친환경 제품", regions: [], tier1: [], tier2: [], tier3: [], titleAfter: "", metaAfter: "", h1After: "", notes: [] } as never, p);
    const kws = [...st.tier1, ...st.tier2, ...st.tier3].map((t) => t.keyword).join(" ");
    assert.ok(/사회적기업/.test(kws) && /공공구매|ESG/.test(kws));
  });
});

describe("v4.1 실측 필드 (robots/sitemap)", () => {
  it("Disallow:/ 전체 차단은 fail로 표시", () => {
    const s = sig({ robotsTxt: { found: true, disallowAll: true, declaresSitemap: false }, sitemapFound: false });
    const core = computeCoreReadiness(s);
    assert.equal(core.checks.find((c) => c.id === "core-robots")!.status, "fail");
  });
  it("실측 실패 시 not_observed (감점 아님)", () => {
    const s = sig({ robotsTxt: null, sitemapFound: undefined });
    const core = computeCoreReadiness(s);
    assert.equal(core.checks.find((c) => c.id === "core-robots")!.status, "not_observed");
    assert.equal(core.checks.find((c) => c.id === "core-sitemap")!.status, "not_observed");
  });
});

function fakeResult(): Omit<DiagnosisResult, "markdownReport"> {
  const s = sig({ bodyText: SE_BODY });
  const profile = classifyHeuristically(s, { url: s.url });
  const adaptiveScores = computeAdaptiveScores(s, profile);
  return {
    id: "t", createdAt: new Date().toISOString(), input: { url: s.url, company: "가치잇다" },
    siteTitle: s.title, siteDescription: s.description, crawledPages: [s.url], overallScore: 55, grade: "C",
    reliability: { confidence: "medium" } as never, executiveSummary: "요약", axes: [], keyInsights: [],
    quickWins: [{ title: "OG 태그 추가", description: "", impact: "high", effort: "low" }], highImpactPriorities: [], roadmap: [],
    seoPlaybook: {} as never, keywordStrategy: { tier1: [{ keyword: "친환경 제품", intent: "" }], tier2: [], tier3: [] } as never,
    searchMeasure: {} as never, naverSeo: {} as never, localSeo: {} as never, hero: {} as never,
    conversion: evaluateConversion(s, profile), adReadiness: {} as never, servicePages: {} as never,
    competitorComparison: {} as never, aiPrecheck: { enabled: false, provider: "none", model: null, usedWebSearch: false, summary: "", priorities: [], messaging: null, competitorCandidates: [], googlePresence: null, citations: [] },
    businessProfile: profile, adaptiveScores, consistencyWarnings: [],
    previsitQuality: undefined as never, briefMarkdown: "", easyMarkdown: "",
    methodology: "",
  };
}

describe("v4.1 AI 품질 패스", () => {
  it("AI JSON을 파싱해 쉬운 요약·브리핑·자기검증 생성", async () => {
    const aiCall = (async () => ({ provider: "openai", model: "gpt-5.6", citations: [], output: JSON.stringify({
      easySummary: { headline: "손님이 가게를 찾기 어려운 상태입니다.", whatWeChecked: "검색과 문의 경로를 봤습니다.", topRisks: [{ title: "검색에 잘 안 나옴", whyPlain: "간판 없는 가게와 같습니다.", todo: "제목을 고치세요." }], quickWinsPlain: ["제목 정리"] },
      previsitBrief: { companySnapshot: "사회적기업 스냅샷", channelSnapshot: ["홈페이지만 운영"], expectedPainPoints: [{ point: "검색 미노출", evidence: "robots 차단" }], meetingQuestions: ["매출 구성은?", "담당자는?"], talkingPoints: ["공공판로 강화"] },
      qualityFlags: [{ code: "OK", message: "무리한 단정 없음" }],
    }) })) as never;
    const q = await runPrevisitQualityPass(fakeResult(), { aiCall, aiAvailable: true });
    assert.equal(q.source, "ai");
    assert.equal(q.easySummary.topRisks.length, 1);
    const brief = buildBriefMarkdown(fakeResult(), q);
    assert.ok(brief.includes("방문 전 브리핑 팩") && brief.includes("매출 구성은?"));
    const easy = buildEasyMarkdown(fakeResult(), q);
    assert.ok(easy.includes("손님이 가게를 찾기 어려운") && easy.includes("점수 요약"));
  });

  it("AI 실패 시 규칙 기반 폴백 (항상 결과 보장)", async () => {
    const bad = (async () => ({ provider: "openai", model: "gpt-5.6", citations: [], output: "not json" })) as never;
    const q = await runPrevisitQualityPass(fakeResult(), { aiCall: bad, aiAvailable: true });
    assert.equal(q.source, "fallback");
    assert.ok(q.previsitBrief.meetingQuestions.length >= 5);
    const q2 = await runPrevisitQualityPass(fakeResult(), { aiAvailable: false });
    assert.equal(q2.source, "fallback");
  });
});
