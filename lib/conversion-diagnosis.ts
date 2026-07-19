import type { ParsedSiteSignals } from "./crawl";
import type { ConversionDiagnosisReport, DiagnosticCheck } from "./types";
import type { BusinessProfile } from "./business-profile-types";
import { isEcommerceMotion, isOrgBuyerMotion } from "./business-profile-types";

const points = (s: DiagnosticCheck["status"]) => s === "pass" ? 1 : s === "warn" ? 0.5 : s === "not_observed" ? 0.25 : 0;

export function evaluateConversion(signals: ParsedSiteSignals, profile?: BusinessProfile): ConversionDiagnosisReport {
  const c = signals.conversion || { ctaTexts: [], telLinks: [], mailtoLinks: [], kakaoLinks: [], naverTalkLinks: [], bookingLinks: [], contactPageUrls: [], formCount: signals.hasForm ? 1 : 0 };
  const actionable = c.telLinks.length + c.mailtoLinks.length + c.kakaoLinks.length + c.naverTalkLinks.length + c.bookingLinks.length + c.contactPageUrls.length;
  const consultation = c.kakaoLinks.length + c.naverTalkLinks.length + c.bookingLinks.length;
  const checks: DiagnosticCheck[] = [
    { id: "conversion-cta", title: "CTA 문구와 실제 연결", status: c.ctaTexts.length && actionable ? "pass" : c.ctaTexts.length ? "warn" : "fail", detail: c.ctaTexts.length ? `CTA ${c.ctaTexts.length}개 · 연결 경로 ${actionable}개` : "명확한 상담·문의·신청 CTA가 감지되지 않았습니다.", action: c.ctaTexts.length && !actionable ? "CTA를 실제 문의·예약·전화 링크에 연결하세요." : "핵심 행동 하나를 명확한 버튼으로 추가하세요." },
    { id: "conversion-tel", title: "모바일 전화 전환", status: c.telLinks.length ? "pass" : signals.phones.length ? "warn" : "fail", detail: c.telLinks.length ? `전화 링크 ${c.telLinks.length}개` : signals.phones.length ? "전화번호 텍스트는 있으나 tel: 링크가 없습니다." : "전화번호와 클릭 전화 링크를 찾지 못했습니다.", action: "대표 전화번호를 tel: 링크로 만들어 모바일에서 바로 통화하게 하세요." },
    { id: "conversion-form", title: "폼 또는 예약·상담 경로", status: c.formCount || consultation ? "pass" : actionable ? "warn" : "fail", detail: `폼 ${c.formCount}개 · 카카오/네이버/예약 ${consultation}개`, action: "짧은 상담 신청 폼 또는 카카오톡·네이버 톡톡·예약 연결을 추가하세요." },
    { id: "conversion-contact", title: "문의 페이지 접근성", status: c.contactPageUrls.length ? "pass" : signals.hasContact ? "warn" : "fail", detail: c.contactPageUrls.length ? `문의 후보 URL ${c.contactPageUrls.length}개` : "명확한 문의 페이지 URL을 찾지 못했습니다.", action: "상단과 하단에서 동일한 문의 페이지로 이동하도록 연결하세요." },
    { id: "conversion-privacy", title: "폼 개인정보 보호", status: c.formCount && !signals.hasPrivacy ? "fail" : signals.hasPrivacy ? "pass" : "manual", detail: signals.hasPrivacy ? "개인정보처리방침 신호가 있습니다." : c.formCount ? "폼은 있으나 개인정보처리방침 연결이 감지되지 않습니다." : "폼이 없어 수집 동의 연결은 수동 확인 항목입니다.", action: "폼 주변에 수집 목적·항목·보유기간 동의와 개인정보처리방침 링크를 배치하세요." },
  ];
  // v4(§11.3): 비즈니스 모델에 맞지 않는 B2C 전용 항목은 N/A 처리 후 분모에서 제외
  const primary = profile?.primaryMarketMotion;
  if (primary && primary !== "b2c_service" && primary !== "unknown") {
    const naNote = "이 비즈니스 유형의 핵심 전환이 아니므로 감점하지 않습니다(v4 해당 없음).";
    for (const c of checks) {
      if (c.id === "conversion-tel" && (isOrgBuyerMotion(primary) || isEcommerceMotion(primary) || primary === "saas" || primary === "media_content" || primary === "marketplace" || primary === "social_enterprise" || primary === "nonprofit_public_interest")) {
        c.status = "not_applicable"; c.detail = naNote;
      }
      if (c.id === "conversion-form" && isEcommerceMotion(primary) && c.status === "fail") {
        c.status = "not_applicable"; c.detail = "이커머스는 문의 폼 대신 구매·결제 경로로 평가합니다(v4 해당 없음).";
      }
    }
  }
  const scored = checks.filter((c) => c.status !== "manual" && c.status !== "not_applicable");
  const score = Math.round((scored.reduce((sum, c) => sum + points(c.status), 0) / Math.max(1, scored.length)) * 100);
  const topActions = checks.filter((c) => c.status === "fail" || c.status === "warn").map((c) => c.action).slice(0, 3);
  return { score, checks, paths: { ctaTexts: c.ctaTexts, tel: c.telLinks.length, email: c.mailtoLinks.length, kakao: c.kakaoLinks.length, naver: c.naverTalkLinks.length, booking: c.bookingLinks.length, contactPages: c.contactPageUrls.length, forms: c.formCount }, summary: score >= 75 ? "문의·상담으로 이어지는 전환 경로가 비교적 잘 연결되어 있습니다." : score >= 45 ? "행동 유도는 보이지만 실제 연결과 모바일 전환을 보강해야 합니다." : "광고나 검색 유입이 들어와도 문의로 이어질 경로가 부족합니다.", topActions };
}
