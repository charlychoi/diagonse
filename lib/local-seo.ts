/**
 * Local SEO & Google Business Profile / Knowledge Panel strategy.
 *
 * Goal: help a company appear in the RIGHT-SIDE map/knowledge panel on Google
 * (and Naver Place), and strengthen trust signals (NAP consistency, reviews,
 * structured data). This is the "구글 맵 우측 패널" strategy the tool previously
 * lacked — surface HTML alone can't confirm a live GBP, so we combine detected
 * on-page signals with an actionable, verifiable playbook.
 */

import type { ParsedSiteSignals } from "./crawl";
import type { DiagnosisInput } from "./types";

export type LocalCheckStatus = "ok" | "warn" | "missing" | "manual";

export type LocalCheckItem = {
  id: string;
  category: "구글 비즈니스 프로필" | "네이버 플레이스" | "NAP 일관성" | "구조화 데이터" | "신뢰·리뷰";
  title: string;
  status: LocalCheckStatus;
  detail: string;
  action: string;
};

export type LocalSeoReport = {
  /** 0–100 local readiness score (auto-evaluable on-page signals only) */
  score: number;
  ok: number;
  warn: number;
  missing: number;
  manual: number;
  /** detected NAP */
  nap: { name: string; phones: string[]; addresses: string[]; region: string };
  /** structured-data types detected */
  schemaTypes: string[];
  /** true if Organization/LocalBusiness schema present */
  hasOrgSchema: boolean;
  hasLocalBusinessSchema: boolean;
  items: LocalCheckItem[];
  /** ordered GBP knowledge-panel action plan */
  panelPlan: { step: string; why: string }[];
  /** paste-ready LocalBusiness JSON-LD */
  localBusinessJsonLd: string;
  /** paste-ready Organization JSON-LD */
  organizationJsonLd: string;
  /** verification links (human check) */
  verifyLinks: { label: string; url: string; why: string }[];
  disclaimer: string;
};

const NAVER = (q: string) =>
  `https://m.search.naver.com/search.naver?query=${encodeURIComponent(q)}`;

function addressRegionFrom(addrs: string[] | undefined): string {
  const a = (addrs ?? [])[0] || "";
  const m = a.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\s]*\s?([가-힣]{1,6}(?:시|군|구))?/);
  return m ? [m[1], m[2]].filter(Boolean).join(" ") : "";
}

function status(cond: boolean, ok: LocalCheckStatus = "ok", no: LocalCheckStatus = "missing") {
  return cond ? ok : no;
}

export async function evaluateLocalSeo(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
): Promise<LocalSeoReport> {
  const brand = (input.company || "").trim() || signals.hostname.split(".")[0];
  const region =
    (addressRegionFrom(signals.addressHints) || input.industry || "").split(",")[0]?.trim() || "";
  const phones = signals.phones ?? [];
  const addresses = signals.addressHints ?? [];
  const schemaTypes = signals.schemaTypes ?? [];
  const hasOrg = schemaTypes.some((t) => /Organization/i.test(t));
  const hasLocal = schemaTypes.some((t) => /LocalBusiness|Store|ProfessionalService|MedicalBusiness/i.test(t));
  const service = input.keywords?.[0] || input.industry || "서비스";

  const items: LocalCheckItem[] = [
    {
      id: "nap-page",
      category: "NAP 일관성",
      title: "홈페이지에 상호·주소·전화(NAP) 노출",
      status:
        phones.length && addresses.length
          ? "ok"
          : phones.length || addresses.length
            ? "warn"
            : "missing",
      detail: `감지: 전화 ${phones.length}건${phones[0] ? ` (${phones[0]})` : ""} · 주소 ${addresses.length}건${addresses[0] ? ` (${addresses[0]})` : ""}.`,
      action:
        "푸터·연락처 페이지에 상호·주소·대표전화를 HTML 텍스트로 명확히 노출(이미지 X). 구글·네이버·카카오맵과 완전히 동일한 표기 사용.",
    },
    {
      id: "schema-org",
      category: "구조화 데이터",
      title: "Organization 구조화 데이터(JSON-LD)",
      status: status(hasOrg, "ok", "missing"),
      detail: hasOrg
        ? `Organization 계열 스키마 감지: ${schemaTypes.join(", ")}`
        : "Organization 스키마가 감지되지 않았습니다 — 구글이 홈페이지와 브랜드를 같은 엔티티로 묶기 어렵습니다.",
      action: "홈 <head>에 Organization JSON-LD 삽입(하단 코드). 로고·sameAs(SNS)·연락처 포함.",
    },
    {
      id: "schema-local",
      category: "구조화 데이터",
      title: "LocalBusiness 구조화 데이터(지도 패널용)",
      status: status(hasLocal, "ok", "missing"),
      detail: hasLocal
        ? "LocalBusiness 계열 스키마가 감지됩니다."
        : "LocalBusiness 스키마 미검출 — 지역 검색·지도 패널에 불리합니다.",
      action:
        "LocalBusiness JSON-LD 삽입(하단 코드). name·address·telephone·openingHours·geo 포함, GBP 정보와 100% 일치.",
    },
    {
      id: "map-embed",
      category: "네이버 플레이스",
      title: "네이버 플레이스 등록 + 지도 임베드",
      status: status(signals.hasMapEmbed, "ok", "warn"),
      detail: signals.hasMapEmbed
        ? "페이지에 지도 임베드가 감지됩니다."
        : "지도 임베드가 감지되지 않았습니다. 지역 신뢰·오시는 길에 지도가 유용합니다.",
      action:
        `네이버 스마트플레이스에 '${brand}' 등록(카테고리·사진·소개·전화). 홈 '오시는 길'에 네이버/구글 지도 임베드.`,
    },
    {
      id: "hours",
      category: "구글 비즈니스 프로필",
      title: "영업시간 정보 노출",
      status: status(signals.hasHours, "ok", "warn"),
      detail: signals.hasHours
        ? "영업시간 신호가 감지됩니다."
        : "영업시간 신호가 감지되지 않았습니다. 패널·플레이스 완성도에 영향.",
      action: "GBP·플레이스·홈페이지에 영업시간 기재. LocalBusiness openingHours에도 반영.",
    },
  ];

  const auto = items.filter((i) => i.status !== "manual");
  const ok = auto.filter((i) => i.status === "ok").length;
  const warn = auto.filter((i) => i.status === "warn").length;
  const missing = auto.filter((i) => i.status === "missing").length;
  const manual = items.filter((i) => i.status === "manual").length;
  const score = auto.length
    ? Math.round(((ok + warn * 0.5) / auto.length) * 100)
    : 0;

  const panelPlan: { step: string; why: string }[] = [];
  if (!hasOrg) {
    panelPlan.push({
      step: "홈페이지에 Organization JSON-LD를 추가하고 공식 도메인·상호·연락처를 연결",
      why: "홈페이지 분석에서 Organization 구조화 데이터가 실제로 누락되었습니다.",
    });
  }
  if (!hasLocal) {
    panelPlan.push({
      step: "실제 GBP 정보와 일치하는 LocalBusiness JSON-LD 추가",
      why: "홈페이지 분석에서 LocalBusiness 구조화 데이터가 실제로 누락되었습니다.",
    });
  }
  if (!phones.length || !addresses.length) {
    panelPlan.push({
      step: "홈페이지 푸터·연락처에 대표전화와 도로명 주소를 HTML 텍스트로 표시",
      why: `홈페이지에서 전화 ${phones.length ? "확인" : "미검출"}, 주소 ${addresses.length ? "확인" : "미검출"} 상태입니다.`,
    });
  }

  const addr = addresses[0] || "(도로명 주소 기재)";
  const tel = phones[0] || "(대표 전화 기재)";
  const localBusinessJsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: brand,
      description: `${brand}는 ${service} 전문 서비스입니다.`,
      url: signals.url,
      telephone: tel,
      address: {
        "@type": "PostalAddress",
        streetAddress: addr,
        addressLocality: region || "(시/구)",
        addressRegion: region || "(시/도)",
        addressCountry: "KR",
      },
      openingHours: "Mo-Fr 09:00-18:00",
      sameAs: signals.socialLinks.map((h) => `https://${h}`),
    },
    null,
    2,
  );
  const organizationJsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: brand,
      url: signals.url,
      logo: `${signals.url.replace(/\/$/, "")}/logo.png`,
      description: `${brand}는 ${service} 전문 서비스입니다.`,
      telephone: tel,
      sameAs: signals.socialLinks.map((h) => `https://${h}`),
    },
    null,
    2,
  );

  const verifyLinks = [
    { label: `네이버 '${brand}' 검색 (플레이스 확인)`, url: NAVER(brand), why: "네이버 플레이스 노출·리뷰·사진" },
    { label: "Rich Results Test (구조화 데이터 검증)", url: "https://search.google.com/test/rich-results", why: "JSON-LD 인식·오류 확인" },
    { label: "구글 비즈니스 프로필 관리", url: "https://business.google.com", why: "GBP 등록·인증·정보 수정" },
  ];

  return {
    score,
    ok,
    warn,
    missing,
    manual,
    nap: { name: brand, phones, addresses, region },
    schemaTypes,
    hasOrgSchema: hasOrg,
    hasLocalBusinessSchema: hasLocal,
    items,
    panelPlan,
    localBusinessJsonLd,
    organizationJsonLd,
    verifyLinks,
    disclaimer:
      "이 결과는 홈페이지 HTML에서 확인된 로컬 SEO 준비 신호만 평가합니다. 실제 검색 순위나 지도·지식 패널 노출 여부는 측정하지 않습니다.",
  };
}

const LB: Record<LocalCheckStatus, string> = {
  ok: "양호",
  warn: "보강",
  missing: "미흡",
  manual: "수동확인",
};

export function formatLocalSeoMarkdown(r: LocalSeoReport): string {
  const lines: string[] = [];
  lines.push(`## 홈페이지 로컬 SEO 준비도 — ${r.score}/100`);
  lines.push("");
  lines.push(`> 홈페이지 자동 점검: 양호 ${r.ok} · 보강 ${r.warn} · 미흡 ${r.missing} · 확인 필요 ${r.manual}.`);
  lines.push("");
  lines.push(
    `- 감지된 NAP: 전화 ${r.nap.phones.join(", ") || "미검출"} · 주소 ${r.nap.addresses.join(", ") || "미검출"}`,
  );
  lines.push(`- 구조화 데이터: ${r.schemaTypes.join(", ") || "미검출"} (Organization ${r.hasOrgSchema ? "○" : "×"} · LocalBusiness ${r.hasLocalBusinessSchema ? "○" : "×"})`);
  lines.push("");
  lines.push(`### 점검 항목`);
  lines.push("");
  lines.push(`| 상태 | 항목 | 조치 |`);
  lines.push(`| --- | --- | --- |`);
  for (const it of r.items) {
    lines.push(`| ${LB[it.status]} | **${it.title}** (${it.category}) | ${it.action.replace(/\|/g, "/")} |`);
  }
  lines.push("");
  lines.push(`### 로컬 SEO 개선 전략 (순서대로)`);
  lines.push("");
  r.panelPlan.forEach((p, i) => lines.push(`${i + 1}. **${p.step}** — ${p.why}`));
  lines.push("");
  lines.push(`### 붙여넣기용 구조화 데이터`);
  lines.push("");
  lines.push("Organization JSON-LD (홈 `<head>`):");
  lines.push("```json");
  lines.push(r.organizationJsonLd);
  lines.push("```");
  lines.push("LocalBusiness JSON-LD (지도 패널용):");
  lines.push("```json");
  lines.push(r.localBusinessJsonLd);
  lines.push("```");
  lines.push("");
  lines.push(`### 확인 링크 (사람 검증)`);
  lines.push("");
  for (const v of r.verifyLinks) lines.push(`- [${v.label}](${v.url}) — ${v.why}`);
  lines.push("");
  lines.push(`> ${r.disclaimer}`);
  lines.push("");
  return lines.join("\n");
}
