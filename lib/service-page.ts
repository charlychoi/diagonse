import type { ParsedSiteSignals } from "./crawl";
import type { DiagnosticCheck, ServicePageDiagnosis } from "./types";

const value = (s: DiagnosticCheck["status"]) => s === "pass" ? 1 : s === "warn" ? 0.5 : 0;
const check = (id: string, title: string, ok: boolean, partial: boolean, detail: string, action: string): DiagnosticCheck => ({ id, title, status: ok ? "pass" : partial ? "warn" : "fail", detail, action });

export function evaluateServicePages(signals: ParsedSiteSignals): ServicePageDiagnosis {
  const pages = (signals.servicePages || []).map((page) => {
    const text = `${page.title || ""} ${page.h1 || ""} ${page.bodyText}`;
    const checks: DiagnosticCheck[] = [
      check("service-name", "서비스명 명확성", Boolean(page.h1 && page.h1.length >= 3), Boolean(page.title), page.h1 || page.title || "서비스명이 감지되지 않았습니다.", "페이지 H1에 구체적인 서비스명을 명시하세요."),
      check("service-target", "대상 고객", /고객|기업|기관|소상공인|시니어|보호자|담당자|교육생|스타트업|중장년/i.test(text), /대상|누구/i.test(text), "대상 고객 표현을 점검했습니다.", "누구를 위한 서비스인지 첫 문단에 명시하세요."),
      check("service-problem", "고객 문제·니즈", /고민|문제|어려움|필요|해결|개선|전환/i.test(text), /도움|지원/i.test(text), "문제·니즈 표현을 점검했습니다.", "고객이 겪는 문제와 해결 결과를 구체적으로 설명하세요."),
      check("service-offer", "제공 내용", text.length >= 500, text.length >= 250, `분석 텍스트 약 ${text.split(/\s+/).length}단어`, "포함 내용·기간·산출물·진행 방식을 구체화하세요."),
      check("service-process", "절차·프로세스", /과정|절차|진행|단계|이용방법|신청.*상담|예약/i.test(text), /신청|상담|예약/i.test(text), "진행 절차 표현을 점검했습니다.", "상담부터 완료까지 3~5단계로 시각화하세요."),
      check("service-price", "가격·상담 방식", /가격|비용|요금|견적|상담 후 안내/i.test(text), /문의|상담/i.test(text), "가격 또는 상담 안내를 점검했습니다.", "가격 공개가 어렵다면 견적 기준과 상담 방식을 안내하세요."),
      check("service-faq", "FAQ", /FAQ|자주 묻는 질문|Q&A|질문과 답변/i.test(text), /문의/i.test(text), "FAQ 표현을 점검했습니다.", "구매 전 핵심 질문 5개 이상을 FAQ로 추가하세요."),
      check("service-cta", "페이지 CTA", page.ctaTexts.length > 0, page.hasContact, page.ctaTexts.length ? page.ctaTexts.join(", ") : "CTA가 약합니다.", "페이지 중간과 하단에 상담·신청 CTA를 배치하세요."),
      check("service-proof", "사례·후기·성과", /사례|후기|성과|고객사|리뷰|누적|\d+%/i.test(text), /경험|파트너/i.test(text), "근거 신호를 점검했습니다.", "사례·후기·수치 중 검증 가능한 근거를 추가하세요."),
      check("service-contact", "문의·신청 연결", page.hasForm || page.hasContact, page.ctaTexts.length > 0, page.hasForm ? "페이지 내 폼이 있습니다." : page.hasContact ? "문의 신호가 있습니다." : "문의 연결이 약합니다.", "CTA를 실제 문의·신청 경로에 연결하세요."),
    ];
    const score = Math.round((checks.reduce((sum, c) => sum + value(c.status), 0) / checks.length) * 100);
    return { url: page.url, title: page.title, h1: page.h1, score, checks };
  });
  const avg = pages.length ? Math.round(pages.reduce((sum, p) => sum + p.score, 0) / pages.length) : 0;
  const failed = pages.flatMap((p) => p.checks).filter((c) => c.status === "fail");
  const topActions = [...new Set(failed.map((c) => c.action))].slice(0, 4);
  return { pages, summary: !pages.length ? "서비스·상품 페이지 후보를 찾지 못했습니다. 별도 전환 페이지가 없다면 우선 개설하세요." : avg >= 70 ? `${pages.length}개 서비스 페이지의 설명과 전환 구조가 비교적 양호합니다.` : `${pages.length}개 서비스 페이지를 확인했으며 평균 준비도는 ${avg}/100입니다. 설명 구조와 CTA 보강이 필요합니다.`, topActions: topActions.length ? topActions : ["현재 강점을 유지하고 실제 문의 전환율로 페이지별 성과를 검증하세요."] };
}
