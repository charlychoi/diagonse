import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { crawlAndParse } from "../lib/crawl";
import { evaluateHero } from "../lib/hero-diagnosis";
import { evaluateConversion } from "../lib/conversion-diagnosis";
import { evaluateAdReadiness } from "../lib/ad-readiness";
import { evaluateServicePages } from "../lib/service-page";
import { evaluateCompetitors } from "../lib/competitor-comparison";
import { validateAutoRequest } from "../lib/auto-diagnose";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const strongHtml = `<!doctype html><html lang="ko"><head>
  <title>기업 AI 교육과 컨설팅 | 예시회사</title>
  <meta name="description" content="기업 담당자를 위한 AI 교육과 컨설팅으로 업무 전환 성과를 만듭니다.">
  <meta name="viewport" content="width=device-width">
  <meta property="og:title" content="AI 교육"><script>gtag('config','G-1')</script>
</head><body><nav><a href="/service">서비스</a><a href="/contact">문의</a></nav>
  <main><section><h1>기업 담당자를 위한 AI 교육과 컨설팅</h1>
  <p>실무 적용 과정과 전문가 상담으로 업무 생산성을 높입니다.</p>
  <a href="/contact">무료 상담 신청</a><strong>누적 고객사 120개 · 만족도 95%</strong></section></main>
  <a href="tel:0212345678">전화 상담</a><a href="https://pf.kakao.com/example">카카오 상담</a>
  <form><input name="name"></form><a href="/privacy">개인정보처리방침</a><footer>문의 02-1234-5678</footer>
</body></html>`;

const serviceHtml = `<!doctype html><html><head><title>기업 AI 교육 프로그램</title></head><body>
  <h1>기업 AI 실무 교육</h1><p>기업 담당자와 교육생의 업무 문제를 해결하는 맞춤 프로그램입니다.</p>
  <h2>제공 내용</h2><p>진단, 실습, 결과 리포트를 제공합니다. 진행 절차는 상담, 설계, 교육, 성과 확인 4단계입니다.</p>
  <p>비용은 상담 후 견적을 안내합니다.</p><h2>자주 묻는 질문 FAQ</h2><p>교육 기간과 준비물을 안내합니다.</p>
  <p>고객사 사례와 만족도 95% 성과를 확인하세요.</p><a href="/contact">교육 상담 신청</a><form></form>
</body></html>`;

function mockSite(home = strongHtml, service = serviceHtml) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const html = /\/service\/?$/.test(new URL(url).pathname) ? service : home;
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  }) as typeof fetch;
}

describe("5 core AI precheck upgrades", () => {
  it("extracts hero, conversion paths, and service page candidates from HTML", async () => {
    mockSite();
    const signals = await crawlAndParse("https://example.com");
    assert.match(signals.hero?.headline || "", /AI 교육/);
    assert.ok(signals.hero?.ctas.includes("무료 상담 신청"));
    assert.ok((signals.hero?.trustSignals.length || 0) > 0);
    assert.equal(signals.conversion?.telLinks.length, 1);
    assert.equal(signals.conversion?.kakaoLinks.length, 1);
    assert.ok((signals.conversion?.formCount || 0) > 0);
    assert.ok((signals.servicePages?.length || 0) > 0);
  });

  it("scores clear hero, actionable conversion, and ad readiness highly", async () => {
    mockSite();
    const signals = await crawlAndParse("https://example.com");
    const hero = evaluateHero(signals, { url: signals.url, company: "예시회사", keywords: ["AI 교육"] });
    const conversion = evaluateConversion(signals);
    const ads = evaluateAdReadiness(signals, hero, conversion);
    assert.ok(hero.score >= 70);
    assert.ok(conversion.score >= 70);
    assert.ok(ads.score >= 70);
  });

  it("uses an early section heading when H1 is absent", async () => {
    const html = `<html><head><title>예시회사</title></head><body><main><section><h2>기업을 위한 데이터 컨설팅</h2><p>성과를 만드는 실무 지원입니다.</p></section></main></body></html>`;
    mockSite(html, html);
    const signals = await crawlAndParse("https://example.com");
    assert.equal(signals.hero?.headline, "기업을 위한 데이터 컨설팅");
  });

  it("flags CTA text without a real link and missing analytics", async () => {
    const weakHtml = `<html><head><title>예시회사</title><meta name="viewport" content="width=device-width"></head><body><h1>예시회사</h1><button>상담 신청</button><p>02-1234-5678</p></body></html>`;
    mockSite(weakHtml, weakHtml);
    const signals = await crawlAndParse("https://example.com");
    const hero = evaluateHero(signals, { url: signals.url, company: "예시회사" });
    const conversion = evaluateConversion(signals);
    const ads = evaluateAdReadiness(signals, hero, conversion);
    assert.ok(conversion.checks.some((c) => c.id === "conversion-cta" && c.status === "warn"));
    assert.ok(ads.checks.some((c) => c.id === "ad-analytics" && c.status === "fail"));
  });

  it("scores detailed service pages and keeps competitor comparison optional", async () => {
    mockSite();
    const signals = await crawlAndParse("https://example.com");
    const service = evaluateServicePages(signals);
    assert.ok(service.pages.length > 0);
    assert.ok(service.pages[0].score >= 70);
    const disabled = await evaluateCompetitors(signals, { url: signals.url, competitors: [] });
    assert.equal(disabled.enabled, false);
  });

  it("validates and limits competitor URLs without breaking legacy requests", () => {
    const legacy = validateAutoRequest({ url: "https://example.com", company: "예시회사" });
    assert.equal(legacy.ok, true);
    const withCompetitors = validateAutoRequest({ url: "https://example.com", company: "예시회사", competitors: ["competitor1.com", "https://competitor2.com", "ftp://invalid.test", "https://competitor3.com", "https://ignored.com"] });
    assert.equal(withCompetitors.ok, true);
    if (withCompetitors.ok) {
      assert.equal(withCompetitors.data.competitors?.length, 3);
      assert.ok(withCompetitors.data.competitors?.every((url) => url.startsWith("http")));
    }
  });

  it("keeps comparison results when one competitor cannot be crawled", async () => {
    mockSite();
    const ours = await crawlAndParse("https://example.com");
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("broken.test")) return new Response("blocked", { status: 503 });
      return new Response(strongHtml, { status: 200, headers: { "content-type": "text/html" } });
    }) as typeof fetch;
    const report = await evaluateCompetitors(ours, { url: ours.url, competitors: ["https://good.test", "https://broken.test"] });
    assert.equal(report.enabled, true);
    assert.equal(report.competitors.length, 2);
    assert.ok(report.competitors.some((c) => c.error));
    assert.ok(report.competitors.some((c) => !c.error));
  });
});
