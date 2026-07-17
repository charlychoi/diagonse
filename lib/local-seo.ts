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
import type { PlacesResult } from "./places";

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
  liveSearch: {
    performed: boolean;
    method: string;
    found: boolean;
    reason?: string;
    summary: string;
    match: PlacesResult["match"];
  };
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

const SEARCH = (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(q)}`;
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

export function evaluateLocalSeo(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
  places?: PlacesResult,
): LocalSeoReport {
  const brand = (input.company || "").trim() || signals.hostname.split(".")[0];
  const region =
    (addressRegionFrom(signals.addressHints) || input.industry || "").split(",")[0]?.trim() || "";
  const phones = signals.phones ?? [];
  const addresses = signals.addressHints ?? [];
  const schemaTypes = signals.schemaTypes ?? [];
  const hasOrg = schemaTypes.some((t) => /Organization/i.test(t));
  const hasLocal = schemaTypes.some((t) => /LocalBusiness|Store|ProfessionalService|MedicalBusiness/i.test(t));
  const service = input.keywords?.[0] || input.industry || "서비스";

  // ---- live Google Maps / Places verification ----
  const lm = places?.match ?? null;
  const liveDone = !!places?.performed;
  const liveFound = !!places?.found && !!lm;
  let liveSummary: string;
  if (!liveDone) {
    liveSummary =
      places?.reason ||
      "구글 맵 자동 조회 미수행 — Places API 키를 설정하면 실제 등록 여부·별점·리뷰를 자동 진단합니다.";
  } else if (liveFound && lm) {
    const stat = lm.businessStatus === "OPERATIONAL" ? "영업 중" : lm.businessStatus || "";
    liveSummary =
      `✅ 구글 맵에 등록되어 있습니다 — "${lm.name}"` +
      (lm.rating != null ? ` · ★${lm.rating} (리뷰 ${lm.reviewCount ?? 0}개)` : " · 리뷰 없음") +
      (lm.address ? ` · ${lm.address}` : "") +
      (stat ? ` · ${stat}` : "") +
      (lm.confidence !== "high"
        ? " (동일 업체 여부는 홈페이지 링크로 재확인 권장)"
        : "");
  } else {
    liveSummary =
      `⚠️ 구글 맵 검색('${places?.query}')에서 이 업체를 찾지 못했습니다 — GBP 미등록이거나 상호·지역 표기가 달라 검색되지 않을 수 있습니다.`;
  }

  // NAP consistency between page and Google
  let napMatchNote = "";
  if (liveFound && lm) {
    const pagePhoneDigits = phones.map((p) => p.replace(/[^0-9]/g, ""));
    const gPhoneDigits = (lm.phone || "").replace(/[^0-9]/g, "");
    if (gPhoneDigits && pagePhoneDigits.length) {
      napMatchNote = pagePhoneDigits.includes(gPhoneDigits)
        ? "홈페이지 전화와 구글 등록 전화가 일치합니다."
        : `⚠️ 홈페이지 전화(${phones[0]})와 구글 등록 전화(${lm.phone})가 다릅니다 — NAP 불일치.`;
    }
  }

  const items: LocalCheckItem[] = [
    {
      id: "gbp-exists",
      category: "구글 비즈니스 프로필",
      title: "구글 비즈니스 프로필(GBP) / 지도 패널 등록",
      status: liveDone ? (liveFound ? "ok" : "missing") : "manual",
      detail: liveSummary,
      action: liveFound
        ? `이미 구글 맵에 노출됩니다. 다음은 '최적화'가 과제입니다 — 카테고리를 '${service}'에 정확히, 설명·사진·영업시간 보강, 리뷰 확대. ${lm?.mapsUri ? `현재 등록: ${lm.mapsUri}` : ""}`
        : liveDone
          ? `구글 맵에 미노출입니다. business.google.com에서 '${brand}' 비즈니스 등록·소유권 인증(우편/전화) 후 카테고리를 '${service}'로 지정하세요.`
          : `google.com/search에서 '${brand}' 검색 → 우측 패널 확인. 없으면 business.google.com에서 등록·인증. (Places API 키 설정 시 이 확인이 자동화됩니다)`,
    },
    {
      id: "gbp-category",
      category: "구글 비즈니스 프로필",
      title: "GBP 카테고리·설명이 실제 서비스와 일치",
      status: "manual",
      detail:
        "카테고리가 실제 서비스와 다르면 관련 검색에서 패널이 불안정하게 노출됩니다.",
      action:
        `주 카테고리를 '${service}'에 맞게, 보조 카테고리 추가. 설명 첫 문장에 '${brand}는 ${service} 전문' 명시.`,
    },
    {
      id: "reviews",
      category: "신뢰·리뷰",
      title: "구글·네이버 리뷰 확보 (신뢰·패널 안정화)",
      status:
        liveFound && lm && lm.reviewCount != null
          ? lm.reviewCount >= 20
            ? "ok"
            : lm.reviewCount >= 1
              ? "warn"
              : "missing"
          : status(signals.hasReviewSignal, "warn", "missing"),
      detail:
        liveFound && lm && lm.reviewCount != null
          ? `구글 리뷰 ${lm.reviewCount}개${lm.rating != null ? ` · 평점 ${lm.rating}` : ""}. ${lm.reviewCount >= 20 ? "리뷰 신뢰 신호 양호." : "리뷰가 적어 패널 노출·클릭 신뢰가 약합니다."}`
          : signals.hasReviewSignal
            ? "페이지에 리뷰·평점 신호가 감지되나, 실제 GBP/플레이스 리뷰 수는 확인이 필요합니다."
            : "리뷰·평점 신호가 감지되지 않았습니다.",
      action:
        "서비스 완료 안내 시 리뷰 요청 문구+링크 동봉. 목표: 구글 리뷰 20개+ (별점 4.0+). 리뷰에 서비스 키워드가 자연 포함되면 관련 검색에 유리.",
    },
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
      id: "nap-consistency",
      category: "NAP 일관성",
      title: "홈·구글·네이버·카카오맵 NAP 완전 일치",
      status: "manual",
      detail:
        "상호·주소·전화가 채널마다 조금씩 다르면 검색엔진이 같은 업체로 묶는 힘이 약해져 패널이 흔들립니다.",
      action:
        "4곳(홈페이지·GBP·네이버플레이스·카카오맵)의 상호/주소/전화를 한 글자까지 통일. 지점·구주소·번호 혼용 제거.",
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

  const panelPlan = (
    liveFound
      ? [
          {
            step: `이미 구글 맵에 노출 중 — "${lm?.name}"${lm?.rating != null ? ` (★${lm.rating}, 리뷰 ${lm.reviewCount ?? 0})` : ""}. 지금은 '최적화'가 과제입니다.`,
            why: "등록은 됐으니, 정보 정확도·카테고리·리뷰·사진을 다듬어 노출을 안정화·상위화합니다.",
          },
          ...(napMatchNote
            ? [{ step: napMatchNote, why: "홈페이지·구글·네이버·카카오맵의 전화·주소·상호가 100% 같아야 패널이 흔들리지 않습니다." }]
            : []),
          { step: `카테고리를 '${service}'에 정확히 지정, 설명 첫 문장에 '${brand}=${service} 전문' 명시`, why: "카테고리-검색어 정합성이 관련 검색에서의 패널 노출을 좌우합니다." },
          { step: `리뷰 ${lm && lm.reviewCount != null && lm.reviewCount >= 20 ? "유지·응답 관리" : "20개+ 확보(별점 4.0+)"}, 사진 10장+ 등록`, why: "리뷰·사진 신호가 쌓일수록 브랜드·서비스 검색 모두에서 패널이 강해집니다." },
          { step: "홈 <head>에 Organization + LocalBusiness JSON-LD 삽입 (GBP 정보와 100% 일치)", why: "구조화 데이터로 홈페이지와 GBP를 같은 엔티티로 확실히 연결합니다." },
          { step: `수정 후 '${brand}' 재검색 + Rich Results Test로 스키마 검증`, why: "패널 정보 정확도·구조화 데이터 인식을 실측으로 확인합니다." },
        ]
      : liveDone
        ? [
            { step: `⚠️ 구글 맵 미노출 확인됨 — 최우선 과제는 'GBP 신규 등록'입니다.`, why: "패널의 원천은 GBP입니다. 등록·인증 전에는 우측 패널이 뜨지 않습니다." },
            { step: "business.google.com에서 비즈니스 등록 → 우편/전화 소유권 인증", why: "인증을 마쳐야 정보를 통제하고 패널을 노출할 수 있습니다." },
            { step: `카테고리를 '${service}'로, 설명 첫 문장에 '${brand}=${service} 전문' 명시`, why: "카테고리-검색어 정합성이 노출 안정성을 좌우합니다." },
            { step: "NAP(상호·주소·전화)를 홈·GBP·네이버·카카오맵에서 완전 통일", why: "일치하는 NAP가 많을수록 구글이 동일 업체로 확신합니다." },
            { step: "홈 <head>에 Organization + LocalBusiness JSON-LD 삽입", why: "홈페이지와 GBP를 같은 엔티티로 연결합니다." },
            { step: "리뷰 20개+ 확보(별점 4.0+), 사진 10장+ 등록", why: "신뢰 신호가 쌓일수록 패널이 안정적으로 노출됩니다." },
            { step: `등록 후 '${brand}' 재검색으로 패널 노출 확인`, why: "실제 노출·정보 정확도를 실측으로 확인합니다." },
          ]
        : [
    {
      step: `구글에서 '${brand}' 검색 → 우측 패널 노출 여부 캡처 (기준선)`,
      why: "현재 지식/지도 패널이 뜨는지, 정보가 정확한지 먼저 확인합니다. (Places API 키 설정 시 이 단계가 자동화됩니다)",
    },
    {
      step: "GBP 등록·소유권 인증 (business.google.com)",
      why: "패널의 원천은 GBP입니다. 인증이 없으면 패널이 뜨지 않거나 통제 불가합니다.",
    },
    {
      step: `카테고리를 '${service}'로, 설명 첫 문장에 '${brand}=${service} 전문' 명시`,
      why: "카테고리-검색어 정합성이 지도 패널 노출 안정성을 좌우합니다.",
    },
    {
      step: "NAP를 홈·GBP·네이버·카카오맵에서 완전히 통일",
      why: "일치하는 NAP가 많을수록 구글이 동일 업체로 확신하고 패널을 노출합니다.",
    },
    {
      step: "홈 <head>에 Organization + LocalBusiness JSON-LD 삽입",
      why: "구조화 데이터로 홈페이지와 GBP를 같은 엔티티로 연결합니다.",
    },
    {
      step: "리뷰 20개+ 확보(별점 4.0+), 사진 10장+ 등록",
      why: "신뢰 신호가 쌓일수록 브랜드 단독 검색에서도 패널이 안정적으로 노출됩니다.",
    },
    {
      step: `수정 후 '${brand}' 재검색 + Rich Results Test로 스키마 검증`,
      why: "패널 노출·정보 정확도·구조화 데이터 인식을 실측으로 확인합니다.",
    },
  ]);

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
    { label: `구글 '${brand}' 검색 (지도 패널 확인)`, url: SEARCH(brand), why: "우측 지식/지도 패널 노출·정보 정확도" },
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
    liveSearch: {
      performed: liveDone,
      method: places?.method ?? "none",
      found: liveFound,
      reason: places?.reason,
      summary: liveSummary,
      match: lm,
    },
    items,
    panelPlan,
    localBusinessJsonLd,
    organizationJsonLd,
    verifyLinks,
    disclaimer:
      "로컬 SEO 판정은 홈페이지 표면 신호 + 실행 체크리스트 기반입니다. GBP·플레이스의 실제 등록·리뷰·패널 노출은 위 확인 링크로 직접 검증하십시오. 구조화 데이터·NAP 통일이 패널 노출을 보장하지는 않으나, 노출 확률과 정보 정확도를 크게 높입니다.",
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
  lines.push(`## 구글 지도·지식 패널 & 로컬 SEO (신뢰 강화)`);
  lines.push("");
  lines.push(
    `> 목표: 구글에서 **회사명 검색 시 우측에 지도·회사정보 패널**이 뜨고, 네이버 플레이스·리뷰로 신뢰를 높입니다. 로컬 준비도 **${r.score}/100** (양호 ${r.ok} · 보강 ${r.warn} · 미흡 ${r.missing} · 수동 ${r.manual}).`,
  );
  lines.push("");
  lines.push(`### 구글 맵 실검색 결과`);
  lines.push("");
  lines.push(`${r.liveSearch.summary}`);
  if (r.liveSearch.found && r.liveSearch.match?.mapsUri) {
    lines.push("");
    lines.push(`- 구글 지도: ${r.liveSearch.match.mapsUri}`);
  }
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
  lines.push(`### 구글 지도·지식 패널 노출 전략 (순서대로)`);
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
