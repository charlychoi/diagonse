/**
 * v4 공통 기반 점수 coreReadiness (PRD §11.1)
 * 정체성·메시지 15 / 기술·검색 15 / 신뢰·권위 10 / 측정·운영 10 → 100 정규화
 */
import type { ParsedSiteSignals } from "../crawl";
import type { AdaptiveCheck, ScoreCard } from "../business-profile-types";
import { computeScoreCard } from "./journey-score";

export function computeCoreReadiness(signals: ParsedSiteSignals): ScoreCard {
  const checks: AdaptiveCheck[] = [
    // 정체성·메시지
    { id: "core-title", title: "title에 회사·서비스 정체성", status: signals.title ? (signals.title.length >= 10 ? "pass" : "warn") : "fail", detail: signals.title ? `title: ${signals.title.slice(0, 60)}` : "title이 없습니다.", action: "브랜드+핵심 서비스가 드러나는 title을 작성하세요." },
    { id: "core-h1", title: "첫 화면 헤드라인(H1)", status: signals.h1s.length ? "pass" : "fail", detail: signals.h1s.length ? `H1 ${signals.h1s.length}개` : "H1이 없습니다.", action: "누구에게 무엇을 제공하는지 H1로 명시하세요." },
    { id: "core-desc", title: "요약 설명(description)", status: signals.description ? "pass" : "fail", detail: signals.description ? "meta description 있음" : "meta description 없음", action: "검색·공유에 쓰일 요약 설명을 추가하세요." },
    { id: "core-about", title: "회사 소개 페이지", status: signals.hasAbout ? "pass" : "not_observed", detail: signals.hasAbout ? "회사소개 신호 있음" : "회사소개 페이지가 확인되지 않습니다.", action: "회사·팀·연혁을 소개하는 페이지를 연결하세요." },
    // 기술·검색 기반
    { id: "core-https", title: "보안 연결(HTTPS)", status: signals.https ? "pass" : "fail", detail: signals.https ? "HTTPS 적용" : "HTTPS 미적용", action: "SSL 인증서를 적용하세요." },
    { id: "core-mobile", title: "모바일 대응(viewport)", status: signals.hasViewport ? "pass" : "fail", detail: signals.hasViewport ? "viewport 있음" : "viewport 없음", action: "반응형 viewport 메타를 추가하세요." },
    { id: "core-canonical", title: "대표 주소(canonical)", status: signals.canonical ? "pass" : "warn", detail: signals.canonical ? "canonical 지정" : "canonical 미지정", action: "대표 URL을 canonical로 지정하세요." },
    { id: "core-og", title: "공유 미리보기(OG)", status: signals.hasOg ? "pass" : "warn", detail: signals.hasOg ? "OG 태그 있음" : "OG 태그 없음", action: "카톡·SNS 공유 미리보기를 설정하세요." },
    // 신뢰·권위
    { id: "core-privacy", title: "개인정보·정책 페이지", status: signals.hasPrivacy ? "pass" : "not_observed", detail: signals.hasPrivacy ? "정책 신호 있음" : "정책 페이지가 확인되지 않습니다.", action: "개인정보처리방침 등 정책 페이지를 연결하세요." },
    { id: "core-jsonld", title: "구조화 데이터(JSON-LD)", status: signals.hasJsonLd ? "pass" : "warn", detail: signals.hasJsonLd ? "JSON-LD 있음" : "JSON-LD 없음", action: "Organization 스키마부터 추가하세요." },
    // 측정·운영
    { id: "core-analytics", title: "분석 태그", status: signals.hasAnalyticsHints ? "pass" : "not_observed", detail: signals.hasAnalyticsHints ? "분석 스크립트 신호 있음" : "분석 태그가 확인되지 않습니다.", action: "GA4 등 분석 도구를 설치하고 핵심 이벤트를 설계하세요." },
  ];
  return computeScoreCard("core", "공통 온라인 기반", checks);
}
