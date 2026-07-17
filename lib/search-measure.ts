/**
 * Search measurement (실측) helpers.
 *
 * Policy: We do NOT scrape Naver/Google SERPs (ToS / blocking).
 * Instead we generate verification URLs and record human-confirmed outcomes —
 * the same semi-auto pattern as D1 in the 6-axis self-check.
 */

export type SearchCheckStatus = "미확인" | "노출됨" | "안 보임" | "부분노출";

export type SearchCheckItem = {
  id: string;
  platform: "naver" | "google" | "other";
  label: string;
  query: string;
  url: string;
  why: string;
  /** How this maps to consulting D1/D6 */
  mapsTo: string;
  status: SearchCheckStatus;
};

export type SearchMeasureBundle = {
  brand: string;
  service: string;
  hostname: string;
  items: SearchCheckItem[];
  /** Filled after user confirms statuses */
  summary: SearchMeasureSummary | null;
};

export type SearchMeasureSummary = {
  checked: number;
  total: number;
  visible: number;
  missing: number;
  pctVisible: number;
  status: "미입력" | "정상" | "주의" | "취약";
  result: string;
  /** 0–100 score from human-confirmed search checks only */
  score: number;
};

export function naverSearchUrl(q: string): string {
  return `https://m.search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
}

export function googleSearchUrl(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function hostBrandGuess(hostname: string, title?: string | null): string {
  if (title) {
    const part = title.split(/[|·\-–—]/)[0]?.trim();
    if (part && part.length >= 2 && part.length <= 28) return part;
  }
  return hostname.replace(/^www\./, "").split(".")[0] || hostname;
}

export function buildSearchMeasureBundle(opts: {
  url: string;
  title?: string | null;
  company?: string;
  keywords?: string[];
  industry?: string;
}): SearchMeasureBundle {
  let hostname = "";
  try {
    hostname = new URL(
      /^https?:\/\//i.test(opts.url) ? opts.url : `https://${opts.url}`,
    ).hostname;
  } catch {
    hostname = opts.url;
  }

  const brand =
    (opts.company && opts.company.trim()) || hostBrandGuess(hostname, opts.title);
  const service =
    opts.keywords?.[0]?.trim() ||
    opts.industry?.trim() ||
    (opts.title?.split(/[|·\-–—]/)[1]?.trim().split(/[·,]/)[0]?.trim() ??
      "핵심 서비스");
  const kw2 = opts.keywords?.[1]?.trim();

  const defs: Omit<SearchCheckItem, "status">[] = [
    {
      id: "naver-brand",
      platform: "naver",
      label: "네이버 브랜드 단독 검색",
      query: brand,
      url: naverSearchUrl(brand),
      why: "브랜드만 검색했을 때 우리 회사·서비스가 바로 드러나는지 (D6 브랜드 신호)",
      mapsTo: "D6 브랜드 신호",
    },
    {
      id: "naver-brand-svc",
      platform: "naver",
      label: "네이버 브랜드+서비스 검색",
      query: `${brand} ${service}`,
      url: naverSearchUrl(`${brand} ${service}`),
      why: "브랜드와 서비스가 한 묶음으로 노출되는지 (통합 신호)",
      mapsTo: "D6 브랜드+서비스",
    },
    {
      id: "naver-svc",
      platform: "naver",
      label: "네이버 핵심 키워드 1페이지",
      query: service,
      url: naverSearchUrl(service),
      why: "핵심 서비스 키워드 경쟁 노출 (D1 키워드 1p)",
      mapsTo: "D1 키워드 노출",
    },
    {
      id: "naver-site",
      platform: "naver",
      label: "네이버 site: 색인 확인",
      query: `site:${hostname.replace(/^www\./, "")}`,
      url: naverSearchUrl(`site:${hostname.replace(/^www\./, "")}`),
      why: "사이트가 네이버에 색인되어 있는지 (대략적 존재 확인)",
      mapsTo: "D1 색인",
    },
    {
      id: "google-brand",
      platform: "google",
      label: "구글 브랜드 검색",
      query: brand,
      url: googleSearchUrl(brand),
      why: "구글 검색·지도/패널 노출 여부 육안 확인 (D6)",
      mapsTo: "D6 구글",
    },
    {
      id: "google-site",
      platform: "google",
      label: "구글 site: 색인 확인",
      query: `site:${hostname}`,
      url: googleSearchUrl(`site:${hostname}`),
      why: "구글 색인 존재 여부",
      mapsTo: "D1 색인",
    },
  ];

  if (kw2) {
    defs.splice(3, 0, {
      id: "naver-kw2",
      platform: "naver",
      label: "네이버 2순위 키워드",
      query: kw2,
      url: naverSearchUrl(kw2),
      why: "추가 타겟 키워드 1페이지 노출",
      mapsTo: "D1 키워드 노출",
    });
  }

  if (opts.title && opts.title.length > 4) {
    defs.push({
      id: "naver-title",
      platform: "naver",
      label: "네이버 페이지 title 그대로 검색",
      query: opts.title,
      url: naverSearchUrl(opts.title),
      why: "홈 title이 검색에 잡히는지 (D1 제목검색과 유사)",
      mapsTo: "D1 제목검색",
    });
  }

  return {
    brand,
    service,
    hostname,
    items: defs.map((d) => ({ ...d, status: "미확인" as const })),
    summary: null,
  };
}

export function summarizeSearchChecks(
  items: SearchCheckItem[],
): SearchMeasureSummary {
  const checked = items.filter((i) => i.status !== "미확인");
  if (!checked.length) {
    return {
      checked: 0,
      total: items.length,
      visible: 0,
      missing: 0,
      pctVisible: 0,
      status: "미입력",
      result: "검색 실측 미수행 — 링크를 열어 확인 후 결과를 선택해 주세요",
      score: 0,
    };
  }

  const visible = checked.filter(
    (i) => i.status === "노출됨" || i.status === "부분노출",
  ).length;
  const missing = checked.filter((i) => i.status === "안 보임").length;
  const pctVisible = Math.round((visible / checked.length) * 100);

  // Weight: full visible=1, partial=0.5
  const points = checked.reduce((acc, i) => {
    if (i.status === "노출됨") return acc + 1;
    if (i.status === "부분노출") return acc + 0.5;
    return acc;
  }, 0);
  const score = Math.round((points / checked.length) * 100);

  let status: SearchMeasureSummary["status"];
  let result: string;
  if (pctVisible >= 70 && missing === 0) {
    status = "정상";
    result = `검색 실측 확인율 ${pctVisible}% (${visible}/${checked.length}) — 브랜드·키워드 신호가 양호`;
  } else if (pctVisible >= 40) {
    status = "주의";
    result = `검색 실측 확인율 ${pctVisible}% — 일부 쿼리만 노출, 키워드·브랜드 정렬 보강 필요`;
  } else {
    status = "취약";
    result = `검색 실측 확인율 ${pctVisible}% — 색인·키워드 1p·브랜드 신호 전반 취약`;
  }

  return {
    checked: checked.length,
    total: items.length,
    visible,
    missing,
    pctVisible,
    status,
    result,
    score,
  };
}

/** Legend copy for surface axes — shown on Score Card */
export const SURFACE_AXIS_LEGEND = [
  {
    key: "contentSeo",
    short: "검색 실측 아님",
    meaning:
      "이 축 점수는 홈 HTML의 title·메타·H1·본문 분량만 본 것입니다. 네이버/구글에서 실제로 몇 위에 뜨는지는 포함하지 않습니다.",
    howToMeasure:
      "아래 「검색 실측」에서 확인 링크를 열어 노출 여부를 기록하거나, 6대 자가진단 D1을 완료하세요.",
  },
  {
    key: "uxConversion",
    short: "퍼널 실측 아님",
    meaning:
      "CTA 문구·폼 태그가 HTML에 있는지만 봅니다. 로그인 장벽, 문의 중도 이탈, 실제 전환율은 측정하지 않습니다.",
    howToMeasure:
      "6대 자가진단 D5에서 손님 입장으로 글→문의→신청 경로를 직접 걸어 ‘통과/차단’을 기록하세요.",
  },
  {
    key: "socialPaid",
    short: "운영 실측 아님",
    meaning:
      "사이트에 소셜 링크가 있는지, 채널을 스스로 적었는지만 반영합니다. 최근 30·90일 포스팅·광고 집행 여부는 모릅니다.",
    howToMeasure:
      "6대 자가진단 D4에서 채널별 최근 활동 시기·타깃 적합도를 입력하세요.",
  },
  {
    key: "brand",
    short: "메시지 표면",
    meaning:
      "title·H1·About 등 공개 문구의 포지셔닝 신호입니다. 지도·리뷰·NAP 통일 같은 브랜드 검색 실측은 별도입니다.",
    howToMeasure: "검색 실측(브랜드 검색) + 6대 D6 체크리스트를 사용하세요.",
  },
  {
    key: "authorityAi",
    short: "권위 표면",
    meaning:
      "스키마·HTTPS·정책 페이지 등 기술·마크업 신호입니다. AI(제미나이 등) 추천 여부는 직접 물어봐야 합니다.",
    howToMeasure: "6대 D6의 AI 검색 문항을 확인 링크로 검증하세요.",
  },
] as const;
