import type { ParsedSiteSignals } from "./crawl";
import type { AdReadinessReport, ConversionDiagnosisReport, DiagnosticCheck, HeroDiagnosisReport } from "./types";

const scoreOf = (s: DiagnosticCheck["status"]) => s === "pass" ? 1 : s === "warn" ? 0.5 : 0;

export function evaluateAdReadiness(signals: ParsedSiteSignals, hero: HeroDiagnosisReport, conversion: ConversionDiagnosisReport): AdReadinessReport {
  const hasCompletionHint = /thank-you|thanks|complete|success|완료|감사/i.test(signals.bodyText);
  const checks: DiagnosticCheck[] = [
    { id: "ad-message", title: "랜딩 메시지 명확성", status: hero.score >= 70 ? "pass" : hero.score >= 40 ? "warn" : "fail", detail: `첫 화면 메시지 점수 ${hero.score}/100`, action: "광고 키워드와 동일한 서비스·혜택을 첫 화면 H1과 보조 설명에 반영하세요." },
    { id: "ad-cta", title: "첫 화면 CTA", status: hero.ctas.length ? "pass" : "fail", detail: hero.ctas.length ? hero.ctas.join(", ") : "첫 화면 CTA가 없습니다.", action: "광고 유입이 즉시 선택할 수 있는 상담·신청 CTA를 추가하세요." },
    { id: "ad-path", title: "문의·예약 연결", status: conversion.score >= 70 ? "pass" : conversion.score >= 40 ? "warn" : "fail", detail: `전환 동선 점수 ${conversion.score}/100`, action: "CTA에서 폼·전화·예약·상담 중 하나로 끊김 없이 연결하세요." },
    { id: "ad-analytics", title: "GA4/GTM 측정 태그", status: signals.hasAnalyticsHints ? "pass" : "fail", detail: signals.hasAnalyticsHints ? "분석 태그 신호가 있습니다." : "GA4/GTM 등 분석 태그를 찾지 못했습니다.", action: "광고 시작 전에 GA4·GTM과 문의/전화/예약 전환 이벤트를 설치하세요." },
    { id: "ad-privacy", title: "개인정보처리방침", status: signals.hasPrivacy ? "pass" : "fail", detail: signals.hasPrivacy ? "정책 링크가 감지됩니다." : "개인정보처리방침이 감지되지 않습니다.", action: "리드 수집 전 개인정보처리방침과 동의 문구를 준비하세요." },
    { id: "ad-mobile", title: "모바일 준비", status: signals.hasViewport ? "pass" : "fail", detail: signals.hasViewport ? "모바일 viewport가 설정되어 있습니다." : "모바일 viewport가 없습니다.", action: "모바일 반응형과 터치 가능한 CTA를 우선 보강하세요." },
    { id: "ad-og", title: "공유 미리보기", status: signals.hasOg ? "pass" : "warn", detail: signals.hasOg ? "Open Graph 신호가 있습니다." : "Open Graph 신호가 없습니다.", action: "og:title·description·image를 설정하세요." },
    { id: "ad-phone", title: "전화 클릭 링크", status: conversion.paths.tel ? "pass" : signals.phones.length ? "warn" : "fail", detail: conversion.paths.tel ? `tel: 링크 ${conversion.paths.tel}개` : "클릭 가능한 전화 링크가 없습니다.", action: "모바일 광고를 위해 대표전화를 tel: 링크로 만드세요." },
    { id: "ad-completion", title: "전환 완료 페이지", status: hasCompletionHint ? "pass" : "manual", detail: hasCompletionHint ? "감사/완료 페이지 후보가 있습니다." : "감사 페이지와 전환 이벤트는 실제 제출 후 확인이 필요합니다.", action: "폼 제출 후 전용 감사 페이지 또는 완료 이벤트가 발생하는지 확인하세요." },
  ];
  const scored = checks.filter((c) => c.status !== "manual");
  const score = Math.round((scored.reduce((sum, c) => sum + scoreOf(c.status), 0) / Math.max(1, scored.length)) * 100);
  const level: AdReadinessReport["level"] = score >= 75 ? "양호" : score >= 45 ? "주의" : "취약";
  const topActions = checks.filter((c) => c.status === "fail" || c.status === "warn").map((c) => c.action).slice(0, 4);
  return { score, level, checks, topActions, summary: level === "양호" ? "기본 광고 유입과 측정 준비가 비교적 양호합니다. 실제 전환 이벤트만 최종 검증하세요." : level === "주의" ? "광고 전 메시지·문의 경로·측정 항목 일부를 먼저 보강해야 합니다." : "현재 상태에서는 광고 유입 손실과 측정 누락 위험이 큽니다. CTA·전환 경로·분석 태그를 먼저 정비하세요." };
}
