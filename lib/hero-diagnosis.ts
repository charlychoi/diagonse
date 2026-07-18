import type { ParsedSiteSignals } from "./crawl";
import type { DiagnosisInput, DiagnosticCheck, HeroDiagnosisReport } from "./types";

function statusScore(status: DiagnosticCheck["status"]): number {
  return status === "pass" ? 1 : status === "warn" ? 0.5 : 0;
}

export function evaluateHero(signals: ParsedSiteSignals, input: DiagnosisInput): HeroDiagnosisReport {
  const hero = signals.hero || { headline: signals.h1s[0] ?? null, subcopy: null, ctas: [], trustSignals: [] };
  const headline = hero.headline || "";
  const brand = (input.company || "").trim();
  const serviceTerms = (input.keywords || []).filter(Boolean);
  const onlyBrand = Boolean(headline && brand && headline.replace(/[^0-9a-z가-힣]/gi, "").toLowerCase() === brand.replace(/[^0-9a-z가-힣]/gi, "").toLowerCase());
  const serviceClear = serviceTerms.length
    ? serviceTerms.some((term) => `${headline} ${hero.subcopy || ""}`.toLowerCase().includes(term.toLowerCase()))
    : headline.length >= 12 && !onlyBrand;
  const checks: DiagnosticCheck[] = [
    {
      id: "hero-headline", title: "첫 화면 핵심 메시지", status: !headline ? "fail" : onlyBrand ? "warn" : "pass",
      detail: headline ? `감지 문구: ${headline}` : "첫 화면에서 명확한 H1 또는 핵심 문구를 찾지 못했습니다.",
      action: !headline ? "대상 고객·서비스·핵심 혜택이 담긴 H1을 추가하세요." : onlyBrand ? "회사명만 쓰지 말고 제공 서비스와 고객 혜택을 함께 명시하세요." : "현재 핵심 문구를 유지하되 서비스와 혜택을 더 구체화하세요.",
    },
    {
      id: "hero-service", title: "서비스·혜택 명확성", status: serviceClear ? "pass" : headline ? "warn" : "fail",
      detail: serviceClear ? "첫 화면에서 서비스 또는 결과 혜택이 비교적 명확합니다." : "추상적 슬로건 또는 회사명 중심으로 보여 서비스 이해가 늦어질 수 있습니다.",
      action: "누구에게 무엇을 제공해 어떤 결과를 만드는지 한 문장으로 작성하세요.",
    },
    {
      id: "hero-subcopy", title: "보조 설명", status: hero.subcopy ? "pass" : "warn",
      detail: hero.subcopy || "헤드라인을 구체화하는 보조 설명이 감지되지 않았습니다.",
      action: "대상 고객·진행 방식·차별점을 1~2문장으로 보완하세요.",
    },
    {
      id: "hero-cta", title: "첫 화면 CTA", status: hero.ctas.length ? "pass" : "fail",
      detail: hero.ctas.length ? `감지 CTA: ${hero.ctas.join(", ")}` : "첫 화면의 문의·상담·신청 버튼이 약합니다.",
      action: "첫 화면에 하나의 주요 CTA를 버튼으로 배치하고 실제 문의 경로에 연결하세요.",
    },
    {
      id: "hero-trust", title: "첫 화면 신뢰 요소", status: hero.trustSignals.length ? "pass" : "warn",
      detail: hero.trustSignals.length ? hero.trustSignals.join(" · ") : "고객사·후기·인증·수치 등 신뢰 신호가 감지되지 않았습니다.",
      action: "hero 하단에 고객사, 후기, 누적 실적, 인증 중 사실에 근거한 1~3개 요소를 추가하세요.",
    },
  ];
  const score = Math.round((checks.reduce((sum, c) => sum + statusScore(c.status), 0) / checks.length) * 100);
  const topActions = checks.filter((c) => c.status !== "pass").map((c) => c.action).slice(0, 3);
  return { score, headline: hero.headline, subcopy: hero.subcopy, ctas: hero.ctas, trustSignals: hero.trustSignals, checks, summary: score >= 75 ? "첫 화면에서 회사의 제안과 행동 경로가 비교적 명확합니다." : score >= 45 ? "첫 화면 메시지는 보이지만 서비스·혜택·CTA를 더 구체화해야 합니다." : "첫 화면만으로 고객이 회사의 서비스와 다음 행동을 이해하기 어렵습니다.", topActions };
}
