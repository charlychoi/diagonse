/**
 * v4.2 전체 파이프라인 종단(End-to-End) 셀프 테스트.
 * AI 미사용(aiEnabled=false, 테스트 환경엔 키가 없음) 조건에서
 * runDiagnosis() 전체를 실행해 다음을 검증한다:
 *  - 분류 후 채점 순서로 예외 없이 완주
 *  - 상세 보고서(markdownReport)에 v4 섹션·쉬운 한국어 라벨이 들어있고
 *    영어 enum(raw objective/buyingCycle 코드) 유출이 없음
 *  - 사전진단 요약(summaryMarkdown)·방문 전 브리핑(briefMarkdown)이
 *    "쉬운 보고서" 같은 옛 용어 없이 규칙 기반 폴백으로 생성됨
 *  - previsitQuality.source === "fallback" (AI 미사용 시 항상 결과 보장)
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { runDiagnosis } from "../lib/analyzer";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const homeHtml = `<!doctype html><html lang="ko"><head>
  <title>재가복지센터 | 동행매니저 케어</title>
  <meta name="description" content="어르신 병원동행과 재가복지 서비스를 제공하는 동행매니저 케어입니다.">
  <meta name="viewport" content="width=device-width">
</head><body><nav><a href="/about">센터소개</a><a href="/apply">신청안내</a><a href="/jobs">동행매니저 지원</a></nav>
  <main><h1>어르신 병원동행, 믿을 수 있는 동행매니저가 함께합니다</h1>
  <p>예약과 상담 문의는 전화로 가능합니다. 프리미엄 의료법률자문 문의도 받고 있습니다.</p>
  <a href="tel:0212345678">전화 상담</a><a href="https://pf.kakao.com/example">카카오 상담</a>
  <form><input name="name"></form><a href="/privacy">개인정보처리방침</a>
  </main><footer>문의 02-1234-5678</footer>
</body></html>`;

function mockSite() {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (/robots\.txt$/.test(url)) return new Response("User-agent: *\nAllow: /", { status: 200 });
    if (/sitemap\.xml$/.test(url)) return new Response("not found", { status: 404 });
    return new Response(homeHtml, { status: 200, headers: { "content-type": "text/html" } });
  }) as typeof fetch;
}

describe("v4.2 전체 파이프라인 종단 테스트 (AI 미사용)", () => {
  it("runDiagnosis가 예외 없이 완주하고 businessProfile/adaptiveScores/previsitQuality를 모두 생성", async () => {
    mockSite();
    const result = await runDiagnosis({ url: "https://example.com", company: "동행매니저 케어" });

    assert.ok(result.businessProfile, "businessProfile 없음");
    assert.ok(result.adaptiveScores, "adaptiveScores 없음");
    assert.ok(result.markdownReport.length > 500, "markdownReport가 비정상적으로 짧음");
    assert.ok(result.previsitQuality, "previsitQuality 없음");
    assert.equal(result.previsitQuality.source, "fallback", "AI 키 없는 테스트 환경에서는 폴백이어야 함");
  });

  it("상세 보고서에 v4 섹션이 있고 objective/buyingCycle 원문 enum이 유출되지 않음", async () => {
    mockSite();
    const result = await runDiagnosis({ url: "https://example.com", company: "동행매니저 케어" });
    const md = result.markdownReport;

    assert.match(md, /## 1\. 비즈니스 모델 판별/);
    assert.match(md, /## 3\. 핵심 고객 여정과 전환/);
    // 과거 버그: "목표 전환: book_service · 구매 주기: short" 같은 원문 enum 유출
    const RAW_GOAL_CODES = ["buy_now", "add_to_cart", "book_service", "call_or_chat", "request_quote", "request_proposal", "contact_sales", "download_company_profile", "view_case_study", "apply_program", "register_jobseeker", "register_employer", "start_trial", "create_account", "subscribe_content", "partner_inquiry", "donate"];
    for (const code of RAW_GOAL_CODES) {
      assert.ok(!md.includes(code), `raw ConversionGoal 코드가 보고서에 그대로 노출됨: ${code}`);
    }
    assert.ok(!/구매 주기: (short|long|instant|procurement|unknown)\b/.test(md), "raw buyingCycle 코드가 그대로 노출됨");
    assert.ok(!md.includes("목표 전환:"), "옛 영어-혼용 라벨(목표 전환:)이 남아있음");
    // 신뢰도는 소수점 원문(0.20)이 아니라 %로 표기
    assert.ok(!/\(0\.\d\d\)/.test(md), "판별 확신도가 소수점 원문으로 노출됨");
  });

  it("대안 가설(있다면) 문구가 사람이 읽기 쉬운 문장 형태", async () => {
    mockSite();
    const result = await runDiagnosis({ url: "https://example.com", company: "동행매니저 케어" });
    const md = result.markdownReport;
    if (md.includes("다르게 볼 수도 있는 가능성")) {
      assert.ok(!md.includes("대안 가설:"), "옛 '대안 가설:' 라벨이 남아있음");
    }
  });

  it("사전진단 요약·방문 전 브리핑이 '쉬운 보고서' 용어 없이 생성됨", async () => {
    mockSite();
    const result = await runDiagnosis({ url: "https://example.com", company: "동행매니저 케어" });
    assert.ok(result.summaryMarkdown.includes("사전진단 요약"));
    assert.ok(!result.summaryMarkdown.includes("쉬운 보고서"));
    assert.ok(result.briefMarkdown.includes("방문 전 브리핑 팩"));
  });

  it("사회적기업 신호가 있는 홈페이지는 social_enterprise로 분류되고 전화 부재로 감점되지 않음", async () => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (/robots\.txt$/.test(url)) return new Response("User-agent: *\nDisallow: /", { status: 200 });
      if (/sitemap\.xml$/.test(url)) return new Response("not found", { status: 404 });
      const html = `<!doctype html><html><head><title>사회적기업 그린핸즈</title>
        <meta name="description" content="고용노동부 인증 사회적기업, 취약계층 고용과 친환경 제품 생산"></head>
        <body><h1>사회적 가치를 만드는 그린핸즈</h1>
        <p>고용노동부 인증 사회적기업으로 취약계층 고용과 사회 성과 연차 보고를 공개합니다. 나라장터 조달 등록, 공공기관 납품 실적이 있습니다.</p>
        <a href="mailto:biz@greenhands.example">기관 문의</a><a href="/store">제품 구매</a>
        </body></html>`;
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }) as typeof fetch;
    const result = await runDiagnosis({ url: "https://greenhands.example", company: "그린핸즈" });
    assert.equal(result.businessProfile.primaryMarketMotion, "social_enterprise");
    const telCheck = result.conversion.checks.find((c) => c.id === "conversion-tel");
    assert.equal(telCheck?.status, "not_applicable");
    // robots.txt 전체 차단 실측이 fail로 잡히는지(최우선 조치 항목)
    assert.equal(result.adaptiveScores.coreReadiness.checks.find((c) => c.id === "core-robots")?.status, "fail");
  });
});
