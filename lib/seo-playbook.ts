/**
 * Brand-search signal alignment playbook (before_after.md).
 *
 * Primary goal (NOT mere HTML checklist):
 * When someone searches on Naver for "{brand}" alone or "{brand} {service}"
 * (e.g. "서브온", "서브온 병원동행"), the site must emit a consistent signal
 * that "{brand} = {service} 전문" so the company is findable.
 *
 * Technical SEO (title tags, robots, OG) is the vehicle; brand–service
 * binding for real Naver brand search is the objective.
 *
 * Pattern source: before_after.md — 서브온 홈페이지 검색 신호 개선 실무 가이드
 */

import type { ParsedSiteSignals } from "./crawl";
import type { DiagnosisInput } from "./types";

export type SignalPresence = "○" | "×" | "△";

export type SeoSignalRow = {
  signal: string;
  inTitle: SignalPresence;
  inDescription: SignalPresence;
  inH1: SignalPresence;
  /** Why this row matters for brand search */
  role: string;
};

export type BeforeAfterCopy = {
  element: string;
  before: string;
  afterA: string;
  afterB?: string;
  afterC?: string;
  principles: string[];
  /** How this change helps brand search on Naver */
  brandSearchWhy: string;
};

export type SeoChecklistItem = {
  order: number;
  task: string;
  doneWhen: string;
  difficulty: "낮음" | "중간" | "높음";
  effect: string;
};

export type BrandSearchQuery = {
  label: string;
  query: string;
  naverUrl: string;
  intent: string;
  whatToLookFor: string;
};

export type BrandVisibilityDiagnosis = {
  /** 0–100 strength of brand↔service binding on homepage signals */
  bindingScore: number;
  level: "강함" | "보통" | "약함" | "위험";
  problem: string;
  rootCauses: string[];
  sideEffect: string;
  goal: string;
  strategySteps: string[];
};

export type SeoPlaybook = {
  oneLiner: string;
  brand: string;
  primaryService: string;
  supportingTerms: string[];
  /** Strategic frame: brand search visibility */
  brandVisibility: BrandVisibilityDiagnosis;
  brandSearchQueries: BrandSearchQuery[];
  measured: {
    url: string;
    title: string;
    description: string;
    h1: string;
    h1Count: number;
    hasOg: boolean;
    logoAltHint: string | null;
  };
  signalMatrix: SeoSignalRow[];
  verdictRows: { question: string; answer: string; note: string }[];
  beforeAfter: BeforeAfterCopy[];
  heroText: {
    headline: string;
    sub: string;
    trustLine: string;
    cta: string;
    imageAlt: string;
  };
  snippetPreview: {
    title: string;
    url: string;
    description: string;
  };
  checklist: SeoChecklistItem[];
  agencyBrief: string[];
  qaCriteria: string[];
  disclaimer: string;
  markdown: string;
};

function hostBrand(hostname: string, title: string | null): string {
  if (title) {
    const part = title.split(/[|·\-–—]/)[0]?.trim();
    if (part && part.length >= 2 && part.length <= 24) return part;
  }
  const host = hostname.replace(/^www\./, "").split(".")[0] || hostname;
  return host;
}

function pickService(input: DiagnosisInput, signals: ParsedSiteSignals): string {
  if (input.keywords?.[0]) return input.keywords[0].trim();
  if (input.industry) return input.industry.trim();
  if (signals.title) {
    const segs = signals.title
      .split(/[|·\-–—]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (segs[1]) {
      const s = segs[1].replace(/서비스|전문|공식|홈페이지/g, "").trim();
      if (s.length >= 2) return s.split(/[·,]/)[0].trim();
    }
  }
  if (signals.h1s[0] && signals.h1s[0].length <= 40) return signals.h1s[0];
  return "핵심 서비스";
}

function presence(hay: string | null | undefined, needle: string): SignalPresence {
  if (!needle) return "×";
  if (!hay) return "×";
  const h = hay.toLowerCase();
  const n = needle.toLowerCase();
  if (h.includes(n)) return "○";
  const tokens = n.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length && tokens.every((t) => h.includes(t))) return "△";
  if (tokens.some((t) => t.length >= 2 && h.includes(t))) return "△";
  return "×";
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function isH1Misaligned(h1: string | null, service: string, brand: string): boolean {
  if (!h1) return true;
  const low = h1.toLowerCase();
  if (/예비사회적기업|사회적기업|로고|logo|인증|공식\s*홈페이지|welcome/i.test(h1))
    return true;
  if (service && service.length >= 2) {
    const head = service.toLowerCase().slice(0, Math.min(4, service.length));
    if (!low.includes(head)) return true;
  }
  if (h1.length < 4) return true;
  if (brand && low === brand.toLowerCase()) return true;
  return false;
}

function naverUrl(q: string): string {
  return `https://m.search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
}

function scoreBinding(opts: {
  brandInTitle: boolean;
  brandInH1: boolean;
  serviceInTitle: boolean;
  serviceInDesc: boolean;
  serviceInH1: boolean;
  specialist: boolean;
  h1Bad: boolean;
  hasOg: boolean;
  wordCount: number;
}): { score: number; level: BrandVisibilityDiagnosis["level"] } {
  let s = 20;
  if (opts.brandInTitle) s += 12;
  if (opts.serviceInTitle) s += 14;
  if (opts.serviceInDesc) s += 10;
  if (opts.serviceInH1 && !opts.h1Bad) s += 20;
  else if (opts.serviceInH1) s += 6;
  if (opts.brandInH1 && opts.serviceInH1) s += 8;
  if (opts.specialist) s += 10;
  if (opts.hasOg) s += 4;
  if (opts.wordCount >= 300) s += 6;
  if (opts.h1Bad) s -= 12;
  s = Math.max(0, Math.min(100, Math.round(s)));
  const level: BrandVisibilityDiagnosis["level"] =
    s >= 75 ? "강함" : s >= 55 ? "보통" : s >= 35 ? "약함" : "위험";
  return { score: s, level };
}

/**
 * Build brand-search alignment playbook from crawl + keywords.
 */
export function buildSeoPlaybook(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
): SeoPlaybook {
  const brand =
    (input.company && input.company.trim()) ||
    hostBrand(signals.hostname, signals.title);
  const primaryService = pickService(input, signals);
  const kws = (input.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  const supportingTerms = [
    ...kws.filter((k) => k !== primaryService).slice(0, 4),
    "전문",
  ].filter((v, i, a) => a.indexOf(v) === i);

  const title = signals.title?.trim() || "(없음)";
  const description = signals.description?.trim() || "(없음)";
  const h1 = signals.h1s[0]?.trim() || "(H1 없음)";
  const h1Count = signals.h1s.length;
  const h1Bad = isH1Misaligned(signals.h1s[0] ?? null, primaryService, brand);

  const brandInTitle = presence(signals.title, brand) === "○";
  const brandInH1 = presence(signals.h1s.join(" "), brand) === "○";
  const serviceInTitle = presence(signals.title, primaryService) === "○";
  const serviceInDesc = presence(signals.description, primaryService) === "○";
  const serviceInH1 = presence(signals.h1s.join(" "), primaryService) === "○";
  const specialistInMeta =
    presence(signals.title, "전문") === "○" ||
    presence(signals.description, "전문") === "○";

  const binding = scoreBinding({
    brandInTitle,
    brandInH1,
    serviceInTitle,
    serviceInDesc,
    serviceInH1,
    specialist: specialistInMeta,
    h1Bad,
    hasOg: signals.hasOg,
    wordCount: signals.wordCount,
  });

  const rootCauses: string[] = [];
  if (h1Bad || !serviceInH1) {
    rootCauses.push(
      `H1이 ‘${primaryService}’ 주제가 아님 (현재: ${truncate(h1, 40)}) — 페이지 주제 신호가 브랜드·서비스 연결에 쓰이지 못함`,
    );
  }
  if (serviceInTitle && serviceInDesc && !serviceInH1) {
    rootCauses.push(
      `title·description에는 ‘${primaryService}’가 있어도 H1에 없으면, 단어는 있으나 ‘${brand} = ${primaryService}’ 묶음 신호가 약함 (before_after.md 핵심 패턴)`,
    );
  }
  if (!serviceInTitle && !serviceInDesc) {
    rootCauses.push(
      `title·description에 핵심 서비스 ‘${primaryService}’ 신호가 약함 — 브랜드 단독 검색 시 무엇을 하는 회사인지 전달 실패`,
    );
  }
  if (!specialistInMeta) {
    rootCauses.push(
      `‘전문’ 포지셔닝 표현 부재 — 경쟁 키워드·브랜드 검색에서 차별 신호가 약함`,
    );
  }
  if (signals.wordCount < 250 || signals.imageCount > signals.imagesWithAlt + 2) {
    rootCauses.push(
      "히어로·핵심 카피가 이미지에만 있거나 본문 앞 텍스트가 약하면 검색엔진이 첫 화면 메시지를 거의 못 읽음",
    );
  }
  if (!signals.hasOg) {
    rootCauses.push("OG 메타 부재 — 공유·일부 수집 경로에서도 브랜드·서비스 문구가 약해짐");
  }
  if (!rootCauses.length) {
    rootCauses.push(
      "표면 신호는 양호한 편 — 네이버 실검색(브랜드 단독·브랜드+서비스)으로 노출 품질을 재검증할 것",
    );
  }

  const problem =
    binding.level === "위험" || binding.level === "약함"
      ? `네이버에서 ‘${brand}’ 또는 ‘${brand} ${primaryService}’를 검색해도 홈 신호가 ‘${brand} = ${primaryService} 전문’으로 충분히 정렬되지 않아, 기업·서비스가 안 보이거나 빈약하게 보이는 부작용이 날 수 있습니다.`
      : binding.level === "보통"
        ? `‘${brand}’–‘${primaryService}’ 연결 신호는 일부 있으나 H1·전문 표현·히어로 텍스트 등에서 빈틈이 있어 브랜드 검색 스니펫·주제 인식이 흔들릴 수 있습니다.`
        : `홈 표면상 ‘${brand}’–‘${primaryService}’ 연결 신호는 양호합니다. 실검색 화면과 채널(블로그·플레이스) 메시지가 같은 방향으로 유지되는지 확인하세요.`;

  const sideEffect =
    `부작용 예시(서브온 사례 일반화): 핵심 키워드·브랜드를 쳐도 “무슨 일을 하는 회사인지”가 검색 결과에 안 잡히면, ` +
    `문의·예약 전환 이전에 발견 단계에서 이탈합니다. HTML 태그를 형식적으로 채우는 것만으로는 부족하고, ` +
    `title·H1·본문·채널명에 동일하게 ‘${brand} = ${primaryService}’를 반복 정렬해야 합니다.`;

  const goal =
    `목표: 네이버에서 (1) ‘${brand}’ 단독 검색 시 서비스 정체성이 즉시 드러나고, ` +
    `(2) ‘${brand} ${primaryService}’ 검색 시 공식 홈·콘텐츠가 관련 결과로 잡힐 확률을 높이는 것. ` +
    `서치어드바이저 기술 가이드 준수는 전제 조건이며, 본 플레이북의 성과 지표는 브랜드 검색 시인성·문의입니다.`;

  const strategySteps = [
    `진단: 네이버에서 ‘${brand}’, ‘${brand} ${primaryService}’, ‘${primaryService}’ 실검색 → 스니펫·사이트 설명이 서비스와 맞는지 캡처`,
    `원인: 신호 매트릭스로 브랜드/서비스/전문이 title·desc·H1에 동시에 있는지 확인 (단어 있음 ≠ 신호 강함)`,
    `처방: H1을 서비스 주제로, title 앞부분을 ‘${brand} | ${primaryService} 전문…’으로 정렬 (before_after 문안)`,
    `본문: 히어로를 HTML 텍스트로 — 이미지 속 글자만으로는 브랜드 검색 보강이 안 됨`,
    `채널: 블로그명·플레이스·연관채널에도 동일 메시지 (‘${brand} ${primaryService}’) — 홈만 고치면 클러스터 신호가 분산`,
    `검증: 수정 후 동일 쿼리 재검색·서치어드바이저 URL 검사 — 순위 보장이 아니라 스니펫·주제 일치 여부로 판단`,
  ];

  const brandVisibility: BrandVisibilityDiagnosis = {
    bindingScore: binding.score,
    level: binding.level,
    problem,
    rootCauses,
    sideEffect,
    goal,
    strategySteps,
  };

  const brandSearchQueries: BrandSearchQuery[] = [
    {
      label: "브랜드 단독 검색 (최우선)",
      query: brand,
      naverUrl: naverUrl(brand),
      intent: `손님이 ‘${brand}’만 쳤을 때 회사·서비스가 바로 보이는가`,
      whatToLookFor: `결과 제목·설명에 ‘${primaryService}’ 또는 동등 서비스명이 보이는지, 공식 사이트로 인식되는지`,
    },
    {
      label: "브랜드 + 핵심 서비스",
      query: `${brand} ${primaryService}`,
      naverUrl: naverUrl(`${brand} ${primaryService}`),
      intent: `‘${brand} ${primaryService}’ 조합이 한 묶음으로 노출되는가`,
      whatToLookFor: "홈·블로그·플레이스가 같은 서비스로 묶여 보이는지",
    },
    {
      label: "핵심 서비스 키워드",
      query: primaryService,
      naverUrl: naverUrl(primaryService),
      intent: "서비스 키워드 경쟁 속에서 우리 브랜드가 식별 가능한가",
      whatToLookFor: "1페이지 노출 여부(실측) + 스니펫에 브랜드명 동반 여부",
    },
  ];
  if (kws[1]) {
    brandSearchQueries.push({
      label: "보조 키워드 (2순위)",
      query: kws[1],
      naverUrl: naverUrl(kws[1]),
      intent: "상황형·2층 키워드 유입 시 브랜드 연결",
      whatToLookFor: "콘텐츠 제목·설명에 브랜드·서비스 동시 노출",
    });
  }

  const matrixSignals: { signal: string; role: string }[] = [
    { signal: brand, role: "브랜드 단독 검색 시 주체" },
    { signal: primaryService, role: "‘무엇을 하는 회사인지’ 핵심" },
    { signal: "전문", role: "포지셔닝·신뢰 강도" },
    ...kws
      .filter((k) => k !== primaryService)
      .slice(0, 3)
      .map((k) => ({ signal: k, role: "보조·상황 키워드" })),
  ];

  const signalMatrix: SeoSignalRow[] = matrixSignals.map(({ signal, role }) => ({
    signal,
    inTitle: presence(signals.title, signal),
    inDescription: presence(signals.description, signal),
    inH1: presence(signals.h1s.join(" "), signal),
    role,
  }));

  const oneLinerFull =
    `【브랜드 검색 목표】 네이버 ‘${brand}’ / ‘${brand} ${primaryService}’ 검색 시 노출 신호 강화. ` +
    `브랜드–서비스 연결 강도 **${binding.score}점(${binding.level})**. ` +
    (h1Bad
      ? `핵심 원인: H1이 서비스 주제가 아님(“${truncate(h1, 28)}”). `
      : "") +
    (serviceInTitle && !serviceInH1
      ? `title에 서비스 단어는 있어도 H1 미정렬로 ‘${brand}=${primaryService}’ 묶음이 약함. `
      : "") +
    `처방: title·H1·히어로 텍스트를 한 방향(“${brand} ${primaryService} 전문”)으로 정렬. ` +
    `HTML 가이드 준수는 전제, 성과는 브랜드 검색 시인성·문의로 판단 (순위 보장 아님).`;

  const afterTitleA = `${brand} | ${primaryService} 전문 서비스 · ${kws[1] || primaryService} · 상담`;
  const afterTitleB = `${brand} ${primaryService} | 전문 · 상담 안내`;
  const afterTitleC = `${brand} | ${primaryService} 전문 — 필요할 때 함께합니다`;

  const afterDescA =
    `${brand}은(는) ${primaryService} 전문 서비스입니다. ` +
    `자격·절차 기반 전문 인력이 핵심 과정을 함께하고 결과를 전달합니다. ` +
    `‘${brand} ${primaryService}’가 필요하면 전화·카카오로 상담하세요.`;
  const afterDescB =
    `${primaryService}이(가) 필요할 때 ${brand}에 맡기세요. ` +
    `검증된 프로세스로 안심할 수 있습니다. 지금 상담.`;

  const afterH1A = `${brand} ${primaryService} — 필요할 때 전문 인력이 함께합니다`;
  const afterH1B = `${brand} ${primaryService} 전문 서비스`;
  const afterH1C = `${primaryService}이(가) 필요할 때, ${brand}`;

  const beforeAfter: BeforeAfterCopy[] = [
    {
      element: "title",
      before: title,
      afterA: truncate(afterTitleA, 58),
      afterB: truncate(afterTitleB, 58),
      afterC: truncate(afterTitleC, 48),
      brandSearchWhy: `네이버 ‘${brand}’ 검색 시 파란 제목에 서비스가 같이 보여 ‘무슨 회사인지’가 즉시 전달됨`,
      principles: [
        `앞쪽: 브랜드 + ${primaryService} (브랜드 단독 검색 대응)`,
        "‘전문’ 명시 — 포지셔닝 강도",
        "부가 사업(B2B 등)은 전용 페이지 title로 분리해 메인 신호 희석 방지",
        "키워드 나열·노출 보장 문구 금지 (네이버 품질 가이드)",
      ],
    },
    {
      element: "meta description",
      before: description,
      afterA: truncate(afterDescA, 155),
      afterB: truncate(afterDescB, 140),
      brandSearchWhy:
        "회색 설명문에 브랜드=서비스 전문 한 줄이 들어가면 스니펫 클릭·인식이 좋아짐",
      principles: [
        `첫 문장: “${brand}은 ${primaryService} 전문” 명시`,
        "무엇을 해주는지 + 신뢰 단서 + 상담 CTA",
        "전 페이지 동일 description·본문 복붙 금지",
      ],
    },
    {
      element: "H1",
      before: h1Count > 1 ? `${h1} (외 H1 ${h1Count - 1}개)` : h1,
      afterA: afterH1A,
      afterB: afterH1B,
      afterC: afterH1C,
      brandSearchWhy:
        "H1이 인증 배지·로고면 엔진이 페이지 주제를 서비스로 못 읽음 → 브랜드 검색 스니펫·주제 연결 실패의 핵심 원인 (before_after.md)",
      principles: [
        `H1 = “${brand} ${primaryService} …” 주제 한 줄 (페이지당 1개)`,
        "로고·예비사회적기업 등 인증은 H1 밖 배지/본문 신뢰 영역",
        `로고 alt: “${brand} — ${primaryService} 전문”`,
      ],
    },
    {
      element: "og:title / og:description",
      before: signals.hasOg
        ? "(OG 존재 — 브랜드·서비스 동시 포함 여부 재확인)"
        : "og:title / og:description 없음",
      afterA: truncate(afterTitleA, 58),
      afterB: truncate(afterDescA, 120),
      brandSearchWhy:
        "네이버 로봇도 OG를 분석·노출에 쓰는 경우가 있음 — 홈 메시지와 동일하게 브랜드·서비스 정렬",
      principles: [
        "title·meta와 같은 ‘브랜드=서비스’ 취지",
        "og:image에 서비스 맥락이 보이게",
      ],
    },
  ];

  const heroText = {
    headline: `${brand} ${primaryService}, 전문 인력이 함께합니다`,
    sub: `접수·진행·마무리까지. ${brand}이(가) ${primaryService} 전 과정을 돕습니다`,
    trustLine: `${primaryService} 전문 · ${brand} · 상담 가능`,
    cta: "전화 상담  ·  카카오 상담  (모바일 상단, 비로그인)",
    imageAlt: `${brand} ${primaryService} 전문 — 전문 인력이 함께합니다`,
  };

  const snippetPreview = {
    title: truncate(afterTitleA, 58),
    url: signals.url || input.url,
    description: truncate(afterDescA, 120),
  };

  const checklist: SeoChecklistItem[] = [
    {
      order: 1,
      task: `네이버 실검색 3종 캡처: ‘${brand}’ / ‘${brand} ${primaryService}’ / ‘${primaryService}’`,
      doneWhen: "수정 전 스니펫·사이트 설명 스크린샷 보관",
      difficulty: "낮음",
      effect: "브랜드 검색 부작용 기준선 확보",
    },
    {
      order: 2,
      task: `title을 ‘${brand} | ${primaryService} 전문…’ 형태로 교체 (After A)`,
      doneWhen: "탭·소스·URL검사에서 확인",
      difficulty: "낮음",
      effect: "브랜드 단독 검색 시 서비스 동반 노출 확률↑",
    },
    {
      order: 3,
      task: `H1을 서비스 주제로 교체 — 로고·인증 배지와 분리`,
      doneWhen: `h1에 ‘${primaryService}’ 포함, 인증 문구는 h1 밖`,
      difficulty: "낮음",
      effect: "페이지 주제=서비스로 엔진 인식 (핵심)",
    },
    {
      order: 4,
      task: "meta description 첫 문장을 ‘브랜드=서비스 전문’으로",
      doneWhen: "소스 확인",
      difficulty: "낮음",
      effect: "스니펫에서 정체성 전달",
    },
    {
      order: 5,
      task: "히어로 카피 HTML 텍스트화 + 의미 있는 alt",
      doneWhen: "텍스트 선택 가능, 카피 이미지 빈 alt 없음",
      difficulty: "낮음",
      effect: "첫 화면 메시지를 로봇이 읽게 함",
    },
    {
      order: 6,
      task: `로고 alt·OG를 ‘${brand} ${primaryService}’ 방향으로 통일`,
      doneWhen: "alt·og:title/description 확인",
      difficulty: "낮음",
      effect: "보조 수집·공유 경로 신호 정렬",
    },
    {
      order: 7,
      task: "블로그·플레이스·채널명에도 동일 메시지 반복",
      doneWhen: "주요 채널 소개에 브랜드+서비스",
      difficulty: "중간",
      effect: "홈만 고친 ‘신호 분산’ 방지 (before_after 채널 정렬)",
    },
    {
      order: 8,
      task: "FAQ·서비스 안내에 질문형 ‘신청·비용·방법’ 텍스트",
      doneWhen: "페이지 텍스트 FAQ 8~10개",
      difficulty: "중간",
      effect: "브랜드+서비스 세부 쿼리·AI 인용 근거",
    },
    {
      order: 9,
      task: "서치어드바이저: 사이트맵·URL 검사 (기술 전제)",
      doneWhen: "소유확인·재수집 요청",
      difficulty: "중간",
      effect: "수집·색인 가능 환경 (순위 보장 아님)",
    },
    {
      order: 10,
      task: "수정 후 동일 3종 쿼리 재검색 + 문의 수 4주 추적",
      doneWhen: "전후 캡처, 문의·예약 KPI",
      difficulty: "낮음",
      effect: "브랜드 검색 시인성·비즈니스 성과 검증",
    },
  ];

  const agencyBrief = [
    `【목표】 네이버 ‘${brand}’·‘${brand} ${primaryService}’ 검색 시 서비스 정체성 노출 강화`,
    `<title> → ${truncate(afterTitleA, 58)}`,
    `meta description → After A (첫 문장: ${brand}=${primaryService} 전문)`,
    `h1 → ${afterH1A} (로고·인증 배지 h1 밖으로)`,
    `로고 alt → ${brand} — ${primaryService} 전문`,
    `히어로 이미지 카피 → HTML 텍스트 병기 + alt`,
    `og:title / og:description → title·desc와 동일 취지`,
    `블로그/플레이스 소개에도 ‘${brand} ${primaryService}’ 동일 문구`,
    `수정 전후 네이버 검색 3종 캡처 보관`,
    `서치어드바이저 URL 검사·재수집`,
  ];

  const qaCriteria = [
    `네이버 ‘${brand}’ 검색 시 스니펫/사이트 설명에 서비스가 드러나는가 (목표 KPI)`,
    `H1·title에 ‘${primaryService}’가 동시에 있는가`,
    "인증·배지가 H1을 점유하지 않는가",
    "핵심 문장이 이미지 없이도 텍스트로 읽히는가",
    "과장·노출 보장·공공 오인 표현 없음",
    "채널 간 메시지 불일치 없음",
  ];

  const disclaimer =
    "본 플레이북의 1차 목적은 HTML 태그 ‘채우기’가 아니라, 네이버에서 브랜드·핵심 서비스 검색 시 " +
    "기업이 안 보이거나 정체성이 약한 부작용을 줄이기 위한 신호 정렬입니다. " +
    "기술 SEO(robots, 사이트맵 등)는 전제 조건이며, 순위·AI 브리핑·지도 노출은 보장하지 않습니다. " +
    "성과는 브랜드 검색 스니펫 품질·문의·예약으로 4주 단위 판단합니다. " +
    "문안 패턴: before_after.md(서브온 ‘서브온=병원동행’ 신호 정렬 사례) 일반화.";

  const verdictRows = [
    {
      question: `‘${primaryService}’ 단어가 title/desc에 있나?`,
      answer:
        serviceInTitle || serviceInDesc ? "예 (일부 존재)" : "아니오 — 거의 없음",
      note: "단어 존재 ≠ 브랜드 검색 시 정체성 전달. H1·전문 표현을 같이 볼 것",
    },
    {
      question: `‘${brand} = ${primaryService}’ 묶음 신호가 강한가?`,
      answer:
        binding.level === "강함" || binding.level === "보통"
          ? `${binding.level} (${binding.score}점)`
          : `아니오 — ${binding.level} (${binding.score}점)`,
      note: h1Bad
        ? "H1 오용·미정렬이 묶음 약화의 전형 원인"
        : "title·H1·히어로 동시 정렬 필요",
    },
    {
      question: `네이버 ‘${brand}’ 단독 검색 시 서비스가 드러날 준비인가?`,
      answer:
        brandInTitle && serviceInTitle && serviceInH1 && !h1Bad
          ? "표면상 준비됨 — 실검색으로 확정"
          : "미흡 — 브랜드 검색 부작용 가능",
      note: sideEffect.slice(0, 80) + "…",
    },
    {
      question: "히어로/본문 앞이 텍스트로 읽히는가?",
      answer:
        signals.wordCount >= 400 ? "부분 양호 가능" : "미흡 가능 (이미지 카피 위험)",
      note: "이미지 속 글자는 브랜드 검색 보강에 거의 기여하지 않음",
    },
  ];

  const playbook: Omit<SeoPlaybook, "markdown"> = {
    oneLiner: oneLinerFull,
    brand,
    primaryService,
    supportingTerms,
    brandVisibility,
    brandSearchQueries,
    measured: {
      url: signals.url || input.url,
      title,
      description,
      h1,
      h1Count,
      hasOg: signals.hasOg,
      logoAltHint: null,
    },
    signalMatrix,
    verdictRows,
    beforeAfter,
    heroText,
    snippetPreview,
    checklist,
    agencyBrief,
    qaCriteria,
    disclaimer,
  };

  return { ...playbook, markdown: formatSeoPlaybookMarkdown(playbook) };
}

export function formatSeoPlaybookMarkdown(
  p: Omit<SeoPlaybook, "markdown">,
): string {
  const bv = p.brandVisibility;
  const lines: string[] = [];
  lines.push(`## 9. 브랜드 검색 노출 전략 · SEO Before → After`);
  lines.push(``);
  lines.push(
    `> **목적:** 네이버에서 \`${p.brand}\` / \`${p.brand} ${p.primaryService}\` 검색 시 기업·서비스가 안 보이거나 정체성이 약한 부작용을 줄이는 것. ` +
      `HTML 가이드 준수는 수단이고, **브랜드=서비스 신호 정렬**이 목표입니다. (패턴: before_after.md · 서브온 병원동행 사례)`,
  );
  lines.push(``);

  lines.push(`### 9-0. 목표 · 문제 · 전략 (Why)`);
  lines.push(``);
  lines.push(`| 항목 | 내용 |`);
  lines.push(`| --- | --- |`);
  lines.push(
    `| 브랜드–서비스 연결 강도 | **${bv.bindingScore}점 · ${bv.level}** |`,
  );
  lines.push(`| 목표 | ${bv.goal} |`);
  lines.push(`| 문제 | ${bv.problem} |`);
  lines.push(`| 부작용 | ${bv.sideEffect} |`);
  lines.push(``);
  lines.push(`**원인 (Root causes)**`);
  for (const c of bv.rootCauses) lines.push(`- ${c}`);
  lines.push(``);
  lines.push(`**전략 단계**`);
  bv.strategySteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push(``);

  lines.push(`### 9-1. 한 줄 결론`);
  lines.push(``);
  lines.push(p.oneLiner);
  lines.push(``);

  lines.push(`### 9-2. 네이버 실검색 검증 쿼리 (반드시 사람 확인)`);
  lines.push(``);
  lines.push(`| 구분 | 쿼리 | 볼 것 | 링크 |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const q of p.brandSearchQueries) {
    lines.push(
      `| ${q.label} | \`${q.query}\` | ${q.whatToLookFor} | [네이버 검색](${q.naverUrl}) |`,
    );
  }
  lines.push(``);
  lines.push(
    `기술 점검(robots·사이트맵)과 별개로, **위 쿼리의 실제 결과 화면**이 성공 KPI입니다.`,
  );
  lines.push(``);

  lines.push(`### 9-3. 왜 title · meta · H1인가 (브랜드 검색 관점)`);
  lines.push(``);
  lines.push(`| 신호 원천 | 브랜드 검색에 미치는 영향 |`);
  lines.push(`| --- | --- |`);
  lines.push(
    `| title | ‘${p.brand}’ 검색 스니펫 파란 제목. 서비스가 안 붙으면 “홈페이지”만 보임 |`,
  );
  lines.push(
    `| meta description | 회색 설명. ‘${p.brand}=${p.primaryService} 전문’ 한 줄이 정체성 전달 |`,
  );
  lines.push(
    `| H1 | 페이지 주제. 인증 배지가 H1이면 엔진이 서비스를 주제로 못 읽음 (핵심 실패 모드) |`,
  );
  lines.push(
    `| 본문 앞 텍스트 | 이미지 카피만 있으면 브랜드 검색 보강 실패 |`,
  );
  lines.push(``);

  lines.push(`### 9-4. 현재 실측 값 (Before)`);
  lines.push(``);
  lines.push(`| 요소 | 현재 값 |`);
  lines.push(`| --- | --- |`);
  lines.push(`| URL | ${p.measured.url} |`);
  lines.push(`| title | ${p.measured.title} |`);
  lines.push(`| meta description | ${p.measured.description} |`);
  lines.push(
    `| H1 | ${p.measured.h1}${p.measured.h1Count > 1 ? ` (총 ${p.measured.h1Count}개)` : ""} |`,
  );
  lines.push(
    `| OG | ${p.measured.hasOg ? "존재" : "없음"} |`,
  );
  lines.push(``);

  lines.push(`### 9-5. 신호 매트릭스 (브랜드 검색용)`);
  lines.push(``);
  lines.push(`| 키워드 | 역할 | title | description | H1 |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  for (const row of p.signalMatrix) {
    lines.push(
      `| ${row.signal} | ${row.role} | ${row.inTitle} | ${row.inDescription} | ${row.inH1} |`,
    );
  }
  lines.push(``);
  lines.push(
    `○=존재 △=부분 ×=없음. **title에만 ○이고 H1이 ×이면** ‘단어는 있는데 주제 신호가 약한’ before_after 전형입니다.`,
  );
  lines.push(``);

  lines.push(`### 9-6. 종합 판정`);
  lines.push(``);
  lines.push(`| 질문 | 판정 | 설명 |`);
  lines.push(`| --- | --- | --- |`);
  for (const v of p.verdictRows) {
    lines.push(`| ${v.question} | ${v.answer} | ${v.note} |`);
  }
  lines.push(``);

  lines.push(`### 9-7. Before → After 문안 (브랜드 검색 강화용)`);
  lines.push(``);
  lines.push(
    `웹/대행사 즉시 반영 초안. 게시 전 과장·공공 오인 검수. 각 변경이 **브랜드 검색에 주는 효과**를 함께 적었습니다.`,
  );
  lines.push(``);

  for (const ba of p.beforeAfter) {
    lines.push(`#### ${ba.element}`);
    lines.push(``);
    lines.push(`| 구분 | 문안 |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Before | ${ba.before.replace(/\|/g, "\\|")} |`);
    lines.push(`| After 권장 A | ${ba.afterA.replace(/\|/g, "\\|")} |`);
    if (ba.afterB)
      lines.push(`| After 대안 B | ${ba.afterB.replace(/\|/g, "\\|")} |`);
    if (ba.afterC)
      lines.push(`| After 대안 C | ${ba.afterC.replace(/\|/g, "\\|")} |`);
    lines.push(``);
    lines.push(`- **브랜드 검색 효과:** ${ba.brandSearchWhy}`);
    lines.push(`**작성 원칙**`);
    for (const pr of ba.principles) lines.push(`- ${pr}`);
    lines.push(``);
  }

  lines.push(`#### 히어로 텍스트 (이미지 밖으로)`);
  lines.push(``);
  lines.push(`| 구분 | 문안 |`);
  lines.push(`| --- | --- |`);
  lines.push(`| 헤드 | ${p.heroText.headline} |`);
  lines.push(`| 서브 | ${p.heroText.sub} |`);
  lines.push(`| 신뢰 | ${p.heroText.trustLine} |`);
  lines.push(`| CTA | ${p.heroText.cta} |`);
  lines.push(`| alt | ${p.heroText.imageAlt} |`);
  lines.push(``);

  lines.push(`### 9-8. 기대 스니펫 (보장 아님 · 방향)`);
  lines.push(``);
  lines.push(`\`\`\``);
  lines.push(p.snippetPreview.title);
  lines.push(p.snippetPreview.url);
  lines.push(p.snippetPreview.description);
  lines.push(`\`\`\``);
  lines.push(``);
  lines.push(
    `이 형태가 네이버 ‘${p.brand}’ 검색 결과에 가까워지는 것이 성공 방향입니다.`,
  );
  lines.push(``);

  lines.push(`### 9-9. 실행 체크리스트 (브랜드 검색 KPI 중심)`);
  lines.push(``);
  lines.push(`| 순서 | 작업 | 완료 기준 | 난이도 | 효과 |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  for (const c of p.checklist) {
    lines.push(
      `| ${c.order} | ${c.task} | ${c.doneWhen} | ${c.difficulty} | ${c.effect} |`,
    );
  }
  lines.push(``);

  lines.push(`### 9-10. 대행사 Copy-paste 지시`);
  lines.push(``);
  p.agencyBrief.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  lines.push(``);

  lines.push(`### 9-11. 검수 · 성과 고지`);
  lines.push(``);
  for (const q of p.qaCriteria) lines.push(`- ${q}`);
  lines.push(``);
  lines.push(p.disclaimer);
  lines.push(``);
  lines.push(
    `참고: 네이버 기술 가이드(robots·canonical 등) 점검은 별도 「네이버 서치어드바이저 가이드 점검」 섹션. ` +
      `기술 통과만으로 브랜드 검색이 해결되지 않으며, 본 섹션의 신호 정렬이 비즈니스 목표에 직결됩니다.`,
  );
  lines.push(``);

  return lines.join("\n");
}
