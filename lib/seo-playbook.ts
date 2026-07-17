/**
 * Brand + main-service search visibility playbook (before_after.md).
 *
 * Primary goal (NOT company-name-only SEO):
 * When someone searches Naver for
 *   - "{brand} {mainService}"  e.g. "서브온 병원동행"  ← 최우선 KPI
 *   - related service / situation queries
 *   - "{brand}" alone
 * the official site (and blog/place cluster) must emit a consistent signal
 * that "{brand} = {mainService} 전문" so the company wins association
 * instead of competitors or irrelevant results.
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
  /** Why this row matters for brand+service search */
  role: string;
};

export type BeforeAfterCopy = {
  element: string;
  before: string;
  afterA: string;
  afterB?: string;
  afterC?: string;
  principles: string[];
  /** How this change helps {brand}+{service} / related queries */
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
  /** 0–100 strength of brand↔main-service binding on homepage signals */
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
  /** Strategic frame: brand+service search visibility */
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

/** Secondary lines of business that dilute main-service signal on home title */
const DILUTION_HINTS =
  /기업복지|임직원\s*복지|B2B|복지몰|쇼핑몰|채용|IR\s*정보|투자|파트너\s*모집/i;

const BAD_H1 =
  /예비사회적기업|사회적기업|로고|logo|인증|공식\s*홈페이지|welcome|주식회사/i;

function hostBrand(hostname: string, title: string | null): string {
  if (title) {
    const part = title.split(/[|·\-–—]/)[0]?.trim();
    if (part && part.length >= 2 && part.length <= 24) return part;
  }
  const host = hostname.replace(/^www\./, "").split(".")[0] || hostname;
  return host;
}

/**
 * Main service = what customers type with brand ("서브온 병원동행").
 * Prefer explicit keywords[0]; strip secondary businesses from title.
 */
function pickService(input: DiagnosisInput, signals: ParsedSiteSignals): string {
  if (input.keywords?.[0]) {
    const k = input.keywords[0].trim();
    // "서브온 병원동행" → 병원동행 if brand prefix
    const company = (input.company || "").trim();
    if (company && k.startsWith(company)) {
      const rest = k.slice(company.length).trim();
      if (rest.length >= 2) return rest;
    }
    return k;
  }

  if (signals.title) {
    const segs = signals.title
      .split(/[|·\-–—]/)
      .map((s) => s.trim())
      .filter(Boolean);
    // After brand segment, take first service-like chunk
    for (let i = 1; i < segs.length; i++) {
      let chunk = segs[i]
        .replace(/서비스|전문|공식|홈페이지/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      // Split compound "병원동행·기업복지 동행" → prefer first non-dilution token
      const parts = chunk
        .split(/[·,\/]/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 2);
      for (const p of parts) {
        if (DILUTION_HINTS.test(p)) continue;
        // Drop trailing generic words
        const cleaned = p.replace(/동행\s*서비스$/g, "동행").trim();
        if (cleaned.length >= 2 && cleaned.length <= 24) return cleaned;
      }
    }
  }

  if (input.industry) {
    const ind = input.industry.trim().split(/[·,\/]/)[0].trim();
    if (ind.length >= 2) return ind;
  }

  // Body / H1 fallback: first short h2-like isn't available; use h1 only if service-like
  if (signals.h1s[0] && signals.h1s[0].length <= 40 && !BAD_H1.test(signals.h1s[0])) {
    return signals.h1s[0].trim();
  }

  return "핵심 서비스";
}

function collectSupporting(
  input: DiagnosisInput,
  primaryService: string,
  brand: string,
  signals: ParsedSiteSignals,
): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (!t || t === primaryService || t === brand) return;
    if (out.some((x) => x === t)) return;
    if (t.length < 2 || t.length > 28) return;
    out.push(t);
  };

  for (const k of input.keywords ?? []) push(k);
  // Extract additional service-ish tokens from title after primary
  if (signals.title) {
    for (const part of signals.title.split(/[|·\-–—,]/)) {
      const p = part
        .replace(new RegExp(brand, "gi"), "")
        .replace(/서비스|전문|공식|홈페이지/g, "")
        .trim();
      if (p && p !== primaryService && !DILUTION_HINTS.test(p)) push(p);
    }
  }
  // Common trust/process terms from body if present
  const body = `${signals.description || ""} ${signals.title || ""}`;
  for (const term of ["상담", "예약", "자격", "인증", "후기", "파트너"]) {
    if (body.includes(term) || (input.keywords || []).some((k) => k.includes(term))) {
      push(term);
    }
  }

  return out.slice(0, 5);
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
  if (BAD_H1.test(h1)) return true;
  if (service && service.length >= 2) {
    const head = service.toLowerCase().slice(0, Math.min(4, service.length));
    if (!low.includes(head)) return true;
  }
  if (h1.length < 4) return true;
  if (brand && low === brand.toLowerCase()) return true;
  return false;
}

function titleDiluted(title: string | null, primaryService: string): boolean {
  if (!title) return false;
  if (DILUTION_HINTS.test(title)) {
    // Dilution only counts if main service is competing with secondary line
    if (primaryService && title.includes(primaryService)) return true;
    return true;
  }
  // Too many · separators → kitchen-sink title
  const parts = title.split(/[·|]/).filter((p) => p.trim().length > 1);
  return parts.length >= 4;
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
  /** brand and service appear as adjacent unit e.g. "서브온 병원동행" */
  compoundInTitle: boolean;
  compoundInH1: boolean;
  specialist: boolean;
  h1Bad: boolean;
  diluted: boolean;
  hasOg: boolean;
  wordCount: number;
}): { score: number; level: BrandVisibilityDiagnosis["level"] } {
  let s = 15;
  if (opts.brandInTitle) s += 8;
  if (opts.serviceInTitle) s += 12;
  if (opts.compoundInTitle) s += 14; // critical for "브랜드 서비스" query
  if (opts.serviceInDesc) s += 8;
  if (opts.serviceInH1 && !opts.h1Bad) s += 18;
  else if (opts.serviceInH1) s += 5;
  if (opts.compoundInH1 && !opts.h1Bad) s += 12;
  if (opts.brandInH1 && opts.serviceInH1) s += 6;
  if (opts.specialist) s += 10;
  if (opts.hasOg) s += 3;
  if (opts.wordCount >= 300) s += 5;
  if (opts.h1Bad) s -= 14;
  if (opts.diluted) s -= 8;
  s = Math.max(0, Math.min(100, Math.round(s)));
  const level: BrandVisibilityDiagnosis["level"] =
    s >= 75 ? "강함" : s >= 55 ? "보통" : s >= 35 ? "약함" : "위험";
  return { score: s, level };
}

/** Situation / benefit lines for H1·hero (domain-agnostic, service-aware) */
function situationLine(primaryService: string, supports: string[]): string {
  if (supports[0]) return `${primaryService}, ${supports[0]}까지 함께합니다`;
  return `${primaryService}, 필요할 때 전문가가 함께합니다`;
}

function processLine(primaryService: string, supports: string[]): string {
  if (supports.length >= 2) {
    return `${supports.slice(0, 3).join(" · ")} 전 과정 지원`;
  }
  return "상담부터 완료까지 전 과정을 함께합니다";
}

function trustBits(supports: string[], signals: ParsedSiteSignals): string {
  const bits: string[] = [];
  if (supports.some((s) => /매니저|전문|자격|강사/.test(s))) bits.push("자격 기반 전문 인력");
  const heads = (signals.h1s || []).concat(signals.h2s || []);
  if (heads.some((h) => /인증|수상|공식|파트너/.test(h))) {
    bits.push("인증·파트너 이력(본문 확인 후 표기)");
  }
  if (!bits.length) bits.push("검증된 프로세스", "상담 가능");
  return bits.slice(0, 3).join(" · ");
}

/**
 * Build brand + main-service search alignment playbook.
 */
export function buildSeoPlaybook(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
): SeoPlaybook {
  const brand =
    (input.company && input.company.trim()) ||
    hostBrand(signals.hostname, signals.title);
  const primaryService = pickService(input, signals);
  const supportingTerms = collectSupporting(input, primaryService, brand, signals);
  const compound = `${brand} ${primaryService}`;

  const title = signals.title?.trim() || "(없음)";
  const description = signals.description?.trim() || "(없음)";
  const h1 = signals.h1s[0]?.trim() || "(H1 없음)";
  const h1Count = signals.h1s.length;
  const h1Bad = isH1Misaligned(signals.h1s[0] ?? null, primaryService, brand);
  const diluted = titleDiluted(signals.title, primaryService);

  const brandInTitle = presence(signals.title, brand) === "○";
  const brandInH1 = presence(signals.h1s.join(" "), brand) === "○";
  const serviceInTitle = presence(signals.title, primaryService) === "○";
  const serviceInDesc = presence(signals.description, primaryService) === "○";
  const serviceInH1 = presence(signals.h1s.join(" "), primaryService) === "○";
  const compoundInTitle = presence(signals.title, compound) !== "×";
  const compoundInH1 = presence(signals.h1s.join(" "), compound) !== "×";
  // Also accept brand|service adjacency without space
  const compoundLooseTitle =
    compoundInTitle ||
    (brandInTitle &&
      serviceInTitle &&
      !!signals.title &&
      signals.title.indexOf(brand) < signals.title.indexOf(primaryService));
  const specialistInMeta =
    presence(signals.title, "전문") === "○" ||
    presence(signals.description, "전문") === "○";

  const binding = scoreBinding({
    brandInTitle,
    brandInH1,
    serviceInTitle,
    serviceInDesc,
    serviceInH1,
    compoundInTitle: compoundLooseTitle,
    compoundInH1,
    specialist: specialistInMeta,
    h1Bad,
    diluted,
    hasOg: signals.hasOg,
    wordCount: signals.wordCount,
  });

  const rootCauses: string[] = [];
  if (h1Bad || !serviceInH1) {
    rootCauses.push(
      `H1이 메인 서비스 ‘${primaryService}’ 주제가 아님 (현재: ${truncate(h1, 40)}) — ‘${compound}’ 검색 시 페이지 주제로 묶이지 못함`,
    );
  }
  if (serviceInTitle && serviceInDesc && !serviceInH1) {
    rootCauses.push(
      `title·description에 ‘${primaryService}’ 단어는 있어도 H1에 없으면, 단어 존재 ≠ ‘${brand} = ${primaryService}’ 묶음 신호 (before_after.md 핵심 패턴)`,
    );
  }
  if (!compoundLooseTitle) {
    rootCauses.push(
      `title에 ‘${compound}’ 단위 신호가 약함 — 네이버 ‘${compound}’ 검색 시 공식 홈·스니펫이 경쟁사·엉뚱한 정보에 밀릴 수 있음`,
    );
  }
  if (!serviceInTitle && !serviceInDesc) {
    rootCauses.push(
      `title·description에 메인 서비스 ‘${primaryService}’ 신호가 약함 — 회사명만 알려져도 서비스 연결이 안 됨`,
    );
  }
  if (diluted) {
    rootCauses.push(
      `메인 title에 부가 사업(기업복지·B2B 등)이 병기되어 ‘${primaryService}’ 신호가 희석됨 — 부가 사업은 전용 페이지 title로 분리 (before_after 원칙)`,
    );
  }
  if (!specialistInMeta) {
    rootCauses.push(
      `‘전문’ 포지셔닝 부재 — ‘${compound}’·유관 검색에서 차별 신호가 약함`,
    );
  }
  if (signals.wordCount < 250 || signals.imageCount > signals.imagesWithAlt + 2) {
    rootCauses.push(
      "히어로·핵심 카피가 이미지에만 있거나 본문 앞 텍스트가 약하면, 서비스·유관 키워드를 엔진이 거의 못 읽음",
    );
  }
  if (!signals.hasOg) {
    rootCauses.push("OG 메타 부재 — 공유·일부 수집 경로에서도 브랜드·서비스 문구가 약해짐");
  }
  if (!rootCauses.length) {
    rootCauses.push(
      `표면 신호는 양호한 편 — 네이버 실검색(‘${compound}’·유관어·브랜드 단독)으로 공식 홈·블로그 연결을 재검증할 것`,
    );
  }

  const problem =
    binding.level === "위험" || binding.level === "약함"
      ? `네이버에서 ‘${compound}’(회사명+메인 서비스) 및 유관 검색어로 찾을 때 공식 홈·블로그가 약하게 보이거나, 엉뚱한 정보·경쟁사 결과가 먼저 노출될 수 있습니다. 회사명 단독 SEO만으로는 이 문제가 해결되지 않습니다.`
      : binding.level === "보통"
        ? `‘${brand}’–‘${primaryService}’ 연결은 일부 있으나 H1·전문 표현·부가사업 희석·히어로 텍스트 빈틈으로 ‘${compound}’ 검색 시인성이 흔들릴 수 있습니다.`
        : `홈 표면상 ‘${brand}’–‘${primaryService}’ 연결 신호는 양호합니다. ‘${compound}’·유관 검색과 채널(블로그·플레이스) 메시지가 같은 방향인지 실측하세요.`;

  const sideEffect =
    `대표 실패 패턴: ‘${compound}’로 검색해도 자사 홈·블로그와 안 묶이면 경쟁사·무관 정보가 노출됩니다. ` +
    `원인은 키워드 부재만이 아니라 title·H1·본문·채널에 ‘${brand} = ${primaryService} 전문’이 한 방향으로 정렬되지 않은 것입니다. ` +
    `회사명만 키우는 SEO는 목표와 다릅니다.`;

  const goal =
    `목표(우선순위 순): (1) 네이버 ‘${compound}’ 검색 시 공식 홈·콘텐츠가 관련 결과로 잡히고, ` +
    `(2) 메인 서비스·유관 검색어에서도 ‘${brand}’가 식별되며, ` +
    `(3) ‘${brand}’ 단독 검색 시에도 서비스 정체성이 즉시 드러날 것. ` +
    `서치어드바이저 기술 준수는 전제이며, KPI는 회사명 순위가 아니라 **메인 서비스 연결 노출·문의**입니다.`;

  const strategySteps = [
    `진단: 네이버에서 ‘${compound}’(최우선) · 유관 키워드 · ‘${brand}’ · ‘${primaryService}’ 실검색 → 공식 홈/블로그 vs 경쟁·무관 결과 캡처`,
    `원인: 신호 매트릭스로 브랜드/메인서비스/전문/유관어가 title·desc·H1에 동시에 있는지 확인 (단어 있음 ≠ 묶음 강함)`,
    `처방: title·H1 앞부분을 ‘${compound}’ 단위로 정렬 — After 문안 A/B (before_after.md 패턴)`,
    `희석 제거: 메인 title에서 부가 사업(기업복지 등) 분리 → 전용 랜딩 title/H1`,
    `본문: 히어로를 HTML 텍스트로 — 이미지 속 글자만으로는 ‘${compound}’ 보강 불가`,
    `채널: 블로그명·글·플레이스·연관채널에 동일 메시지 ‘${brand} = ${primaryService} 전문’ — 홈만 고치면 클러스터 분산`,
    `검증: 수정 후 ‘${compound}’ 재검색 — 순위 보장이 아니라 스니펫·자사 결과 연결·문의로 판단`,
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

  // —— 검색 검증 쿼리: 메인 서비스 결합이 최우선 ——
  const brandSearchQueries: BrandSearchQuery[] = [
    {
      label: "① 회사명 + 메인 서비스 (최우선 KPI)",
      query: compound,
      naverUrl: naverUrl(compound),
      intent: `손님이 ‘${compound}’를 쳤을 때 공식 홈·블로그가 연결되는가 (경쟁·무관 정보 배제)`,
      whatToLookFor: `결과 제목·설명에 ‘${brand}’+‘${primaryService}’ 동시, 공식 사이트·자사 블로그 노출`,
    },
    {
      label: "② 메인 서비스 키워드",
      query: primaryService,
      naverUrl: naverUrl(primaryService),
      intent: `서비스 키워드 경쟁 속에서 ‘${brand}’가 식별되는가`,
      whatToLookFor: "스니펫에 브랜드명 동반·공식 홈 연결 여부 (1페이지는 실측)",
    },
  ];
  for (const term of supportingTerms.slice(0, 3)) {
    brandSearchQueries.push({
      label: `③ 유관·상황 검색어`,
      query: term.includes(brand) ? term : `${term}`,
      naverUrl: naverUrl(term.includes(primaryService) ? term : `${brand} ${term}`),
      intent: `유관어 ‘${term}’ 유입 시 자사로 연결되는가`,
      whatToLookFor: "콘텐츠 제목·설명에 브랜드·메인서비스 동시 노출",
    });
    // also brand + support compound
    if (!term.includes(brand) && term !== primaryService) {
      const q = `${brand} ${term}`;
      if (q !== compound) {
        brandSearchQueries.push({
          label: `③-b 브랜드 + 유관어`,
          query: q,
          naverUrl: naverUrl(q),
          intent: `‘${q}’ 조합이 자사 신호로 묶이는가`,
          whatToLookFor: "홈·블로그·플레이스 동일 메시지",
        });
      }
    }
  }
  brandSearchQueries.push({
    label: "④ 브랜드 단독 (보조)",
    query: brand,
    naverUrl: naverUrl(brand),
    intent: `‘${brand}’만 쳐도 메인 서비스 정체성이 보이는가 (회사명 SEO만이 목표는 아님)`,
    whatToLookFor: `제목·설명에 ‘${primaryService}’ 동반 여부`,
  });

  const matrixSignals: { signal: string; role: string }[] = [
    { signal: compound, role: "최우선 — 회사명+메인서비스 검색 단위" },
    { signal: brand, role: "브랜드 주체" },
    { signal: primaryService, role: "메인 비즈니스·서비스" },
    { signal: "전문", role: "포지셔닝·차별 강도" },
    ...supportingTerms.slice(0, 3).map((k) => ({
      signal: k,
      role: "유관·상황 키워드",
    })),
  ];

  const signalMatrix: SeoSignalRow[] = matrixSignals.map(({ signal, role }) => ({
    signal,
    inTitle: presence(signals.title, signal),
    inDescription: presence(signals.description, signal),
    inH1: presence(signals.h1s.join(" "), signal),
    role,
  }));

  const oneLinerFull =
    `【목표】 네이버 ‘${compound}’ 및 유관 검색어에서 공식 홈·콘텐츠가 연결되도록 신호 정렬 ` +
    `(회사명 단독 SEO ≠ 목표). 브랜드–메인서비스 연결 **${binding.score}점(${binding.level})**. ` +
    (h1Bad
      ? `핵심 원인: H1이 서비스 주제가 아님(“${truncate(h1, 28)}”). `
      : "") +
    (serviceInTitle && !serviceInH1
      ? `title에 서비스 단어는 있어도 H1 미정렬로 ‘${brand}=${primaryService}’ 묶음 약함. `
      : "") +
    (diluted ? `메인 title 부가사업 병기로 메인 서비스 신호 희석. ` : "") +
    `처방: title·H1·히어로를 ‘${compound} 전문’ 한 방향으로 정렬 + 채널 동일 메시지. ` +
    `성과는 순위 보장이 아니라 ‘${compound}’ 실검색 연결·문의로 판단.`;

  // —— Before→After: before_after.md quality templates ——
  const s1 = supportingTerms[0] || primaryService;
  const s2 =
    supportingTerms.find((t) => t !== s1) ||
    (/병원|동행/.test(primaryService) ? "케어리포트" : "상담");
  const sit = situationLine(primaryService, supportingTerms);
  const proc = processLine(primaryService, supportingTerms);
  const trust = trustBits(supportingTerms, signals);

  // A: brand | mainService 전문 · related · related  (before_after title A)
  const afterTitleA = truncate(
    `${brand} | ${primaryService} 전문 서비스 · ${s1} · ${s2}`,
    58,
  );
  // B: "브랜드 서비스" as search unit in the blue title  (before_after title B)
  const afterTitleB = truncate(
    `${compound} | 전문 · ${proc}`,
    58,
  );
  // C: short specialist line
  const afterTitleC = truncate(
    `${brand} | ${primaryService} 전문 — 필요할 때 함께합니다`,
    48,
  );

  const afterDescA = truncate(
    `${brand}은 ${primaryService} 전문 서비스입니다. ` +
      `${proc} 함께하고 결과를 전달합니다. ` +
      `${trust}. ${compound}이 필요하면 전화·카카오로 상담하세요.`,
    155,
  );
  const afterDescB = truncate(
    `${s1}이 필요할 때 ${brand}에 맡기세요. ` +
      `${primaryService} 전문 인력이 안전하게 진행합니다. ` +
      `${trust}. 지금 전화·카카오 상담.`,
    140,
  );

  // H1: brand + service as unit first (before_after H1 A/B/C)
  const afterH1A = `${compound} — ${sit}`;
  const afterH1B = `${compound} 전문 서비스`;
  const afterH1C = `${primaryService}이 필요할 때, ${brand}`;

  const beforeAfter: BeforeAfterCopy[] = [
    {
      element: "title",
      before: title,
      afterA: afterTitleA,
      afterB: afterTitleB,
      afterC: afterTitleC,
      brandSearchWhy:
        `네이버 ‘${compound}’ 검색 시 파란 제목에 브랜드+메인서비스가 한 단위로 보여, 경쟁·무관 결과 대비 공식 홈 식별이 쉬워짐. 회사명만 넣는 title로는 부족`,
      principles: [
        `최우선: 앞쪽에 ‘${brand} + ${primaryService}’ (검색 단위 ‘${compound}’)`,
        "‘전문’ 명시 — 포지셔닝 강도",
        `유관어(${s1}${s2 !== s1 ? `·${s2}` : ""})로 상황 검색 연결`,
        "부가 사업(기업복지·B2B 등)은 메인 title에서 분리 → 전용 페이지",
        "키워드 나열·노출 보장·‘1위’ 문구 금지 (네이버 품질 가이드)",
      ],
    },
    {
      element: "meta description",
      before: description,
      afterA: afterDescA,
      afterB: afterDescB,
      brandSearchWhy:
        `회색 설명 첫 문장에 ‘${brand}=${primaryService} 전문’이 들어가면 ‘${compound}’·유관 검색 스니펫에서 정체성·클릭 인식이 좋아짐`,
      principles: [
        `첫 문장: “${brand}은 ${primaryService} 전문” 명시 (before_after 원칙)`,
        "무엇을 해주는지(과정) + 신뢰 단서 + 상담 CTA",
        "부가 사업·임직원 복지 병기 축소 (메인 서비스 신호 집중)",
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
        `H1이 인증 배지·로고면 엔진이 페이지 주제를 ‘${primaryService}’로 못 읽음 → ‘${compound}’ 검색·스니펫 연결 실패의 핵심 원인 (before_after.md)`,
      principles: [
        `H1 = “${compound} …” 주제 한 줄 (페이지당 1개) — 회사명만 쓰지 말 것`,
        "로고·예비사회적기업 등 인증은 H1 밖 배지/본문 신뢰 영역",
        `로고 alt: “${brand} — ${primaryService} 전문” (영문만 쓰지 않기)`,
      ],
    },
    {
      element: "og:title / og:description",
      before: signals.hasOg
        ? "(OG 존재 — 브랜드+메인서비스 동시 포함 여부 재확인)"
        : "og:title / og:description 없음",
      afterA: afterTitleA,
      afterB: truncate(afterDescA, 120),
      brandSearchWhy:
        "공유·일부 수집 경로에서도 ‘회사+서비스’ 단위 문구가 동일해야 신호가 분산되지 않음",
      principles: [
        `title·meta와 같은 ‘${brand}=${primaryService}’ 취지`,
        "og:image에 서비스 맥락이 보이게",
      ],
    },
  ];

  const heroText = {
    headline: /병원|동행/.test(primaryService)
      ? "부모님 병원 동행, 전문 매니저가 대신합니다"
      : `${primaryService}, 전문 인력이 함께합니다`,
    sub: /병원|동행/.test(primaryService)
      ? "접수부터 진료·검사·수납·약국·귀가까지. 동행 후 케어리포트 전달"
      : `${proc}. ${brand}이(가) ${primaryService} 전 과정을 돕습니다`,
    trustLine: `${primaryService} 전문 · ${brand} · ${trust}`,
    cta: "전화 상담  ·  카카오 상담  (모바일 상단, 비로그인)",
    imageAlt: `${compound} 전문 — 전문 인력이 함께합니다`,
  };

  const snippetPreview = {
    title: afterTitleA,
    url: signals.url || input.url,
    description: truncate(afterDescA, 120),
  };

  const checklist: SeoChecklistItem[] = [
    {
      order: 1,
      task: `네이버 실검색 캡처: ‘${compound}’(최우선) / 유관어 / ‘${brand}’ / ‘${primaryService}’`,
      doneWhen: "수정 전 공식홈·블로그 vs 경쟁·무관 결과 스크린샷",
      difficulty: "낮음",
      effect: "메인 서비스 연결 노출 기준선",
    },
    {
      order: 2,
      task: `title을 ‘${brand} | ${primaryService} 전문…’ 또는 ‘${compound} | …’ 형태로 교체 (After A/B)`,
      doneWhen: "탭·소스·URL검사에서 ‘전문’+메인서비스 확인",
      difficulty: "낮음",
      effect: `‘${compound}’ 검색 스니펫 정렬`,
    },
    {
      order: 3,
      task: `H1을 ‘${compound}’ 주제 문장으로 교체 — 로고·인증 배지와 분리`,
      doneWhen: `h1에 ‘${primaryService}’ 포함, 인증 문구는 h1 밖`,
      difficulty: "낮음",
      effect: "페이지 주제=메인서비스 (핵심)",
    },
    {
      order: 4,
      task: "meta description 첫 문장을 ‘브랜드=메인서비스 전문’으로",
      doneWhen: "소스 확인",
      difficulty: "낮음",
      effect: "유관 검색 스니펫 정체성",
    },
    {
      order: 5,
      task: "메인 title에서 부가 사업(기업복지 등) 분리 → 전용 페이지",
      doneWhen: "홈 title에 메인서비스 집중",
      difficulty: "중간",
      effect: "메인 서비스 신호 희석 제거",
    },
    {
      order: 6,
      task: "히어로 카피 HTML 텍스트화 + 의미 있는 alt",
      doneWhen: "텍스트 선택 가능, 카피 이미지 빈 alt 없음",
      difficulty: "낮음",
      effect: "서비스·유관 키워드 본문 신호",
    },
    {
      order: 7,
      task: `로고 alt·OG를 ‘${compound}’ / ‘${brand} — ${primaryService} 전문’ 방향으로 통일`,
      doneWhen: "alt·og 확인",
      difficulty: "낮음",
      effect: "보조 수집·공유 경로 정렬",
    },
    {
      order: 8,
      task: `블로그·플레이스·채널 소개에 ‘${brand} = ${primaryService} 전문’ 동일 반복`,
      doneWhen: "주요 채널 소개·대표 글 제목에 메인서비스",
      difficulty: "중간",
      effect: "‘홈만 수정’으로 생기는 클러스터 분산 방지",
    },
    {
      order: 9,
      task: "FAQ·서비스 안내에 신청·비용·방법 등 유관 질문형 텍스트",
      doneWhen: "페이지 텍스트 FAQ 8~10개",
      difficulty: "중간",
      effect: "유관 검색·AI 인용 근거",
    },
    {
      order: 10,
      task: `수정 후 ‘${compound}’ 재검색 + 문의 수 4주 추적`,
      doneWhen: "전후 캡처, 문의·예약 KPI",
      difficulty: "낮음",
      effect: "메인 서비스 연결 노출·비즈니스 성과 검증",
    },
  ];

  const agencyBrief = [
    `【목표】 네이버 ‘${compound}’·유관 검색에서 공식 홈·블로그 연결 (회사명 단독 SEO 아님)`,
    `<title> → ${afterTitleA}`,
    `또는 title B → ${afterTitleB}`,
    `meta description → 첫 문장 “${brand}은 ${primaryService} 전문…” (After A)`,
    `h1 → ${afterH1A} (로고·인증 배지 h1 밖으로)`,
    `로고 alt → ${brand} — ${primaryService} 전문`,
    `히어로 이미지 카피 → HTML 텍스트 병기 + alt “${compound} …”`,
    `og:title / og:description → title·desc와 동일 취지`,
    `메인 title에서 부가사업 분리 / 기업·복지 전용 페이지 별도 title·H1`,
    `블로그/플레이스 소개에도 ‘${brand} ${primaryService} 전문’ 동일 문구`,
    `수정 전후 네이버 ‘${compound}’ 검색 캡처 보관`,
    `서치어드바이저 URL 검사·재수집`,
  ];

  const qaCriteria = [
    `네이버 ‘${compound}’ 검색 시 공식 홈·자사 콘텐츠가 연결되는가 (1차 KPI)`,
    `유관 검색어에서도 ‘${brand}’가 식별되는가`,
    `H1·title에 ‘${primaryService}’가 동시에 있고, H1이 인증 배지가 아닌가`,
    "부가 사업 문구가 메인 title 신호를 희석하지 않는가",
    "핵심 문장이 이미지 없이도 텍스트로 읽히는가",
    "과장·노출 보장·공공 오인 표현 없음",
    "채널 간 ‘브랜드=메인서비스’ 메시지 불일치 없음",
  ];

  const disclaimer =
    "본 플레이북의 1차 목적은 회사명 단독 SEO가 아니라, 네이버에서 " +
    `‘${compound}’ 및 메인 서비스·유관 검색어로 찾을 때 공식 기업·콘텐츠가 안 보이거나 ` +
    "경쟁·무관 정보가 노출되는 부작용을 줄이기 위한 신호 정렬입니다. " +
    "기술 SEO(robots, 사이트맵 등)는 전제 조건이며, 순위·AI 브리핑·지도 노출은 보장하지 않습니다. " +
    "성과는 ‘회사+서비스’ 실검색 연결 품질·문의·예약으로 4주 단위 판단합니다. " +
    "문안 패턴: before_after.md(서브온 ‘서브온=병원동행’ · ‘서브온 병원동행’ 검색 연결 사례) 일반화.";

  const verdictRows = [
    {
      question: `‘${compound}’ 단위 신호가 title/H1에 있나?`,
      answer:
        compoundLooseTitle || compoundInH1
          ? "부분 이상 존재"
          : "아니오 — 회사+서비스 묶음 약함",
      note: "이 묶음이 약하면 ‘회사 서비스’ 검색 시 경쟁·무관 결과에 밀림",
    },
    {
      question: `‘${primaryService}’ 단어가 title/desc에 있나?`,
      answer:
        serviceInTitle || serviceInDesc ? "예 (일부 존재)" : "아니오 — 거의 없음",
      note: "단어 존재 ≠ 검색 연결 강함. H1·전문·채널 정렬 필요",
    },
    {
      question: `‘${brand} = ${primaryService}’ 묶음 신호가 강한가?`,
      answer:
        binding.level === "강함" || binding.level === "보통"
          ? `${binding.level} (${binding.score}점)`
          : `아니오 — ${binding.level} (${binding.score}점)`,
      note: h1Bad
        ? "H1 오용·미정렬이 묶음 약화의 전형 원인"
        : diluted
          ? "부가사업 병기로 메인 서비스 희석 가능"
          : "title·H1·히어로·채널 동시 정렬 필요",
    },
    {
      question: `네이버 ‘${compound}’ 검색 연결 준비도`,
      answer:
        brandInTitle && serviceInTitle && serviceInH1 && !h1Bad && !diluted
          ? "표면상 준비됨 — 실검색으로 확정"
          : "미흡 — 공식홈 미연결·경쟁 노출 위험",
      note: sideEffect.slice(0, 90) + "…",
    },
    {
      question: "히어로/본문 앞이 텍스트로 읽히는가?",
      answer:
        signals.wordCount >= 400 ? "부분 양호 가능" : "미흡 가능 (이미지 카피 위험)",
      note: "이미지 속 글자는 서비스·유관 검색 보강에 거의 기여하지 않음",
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
  const compound = `${p.brand} ${p.primaryService}`;
  const lines: string[] = [];
  lines.push(`## 9. 메인 서비스 검색 노출 전략 · SEO Before → After`);
  lines.push(``);
  lines.push(
    `> **목적 (중요):** 회사명만 검색에 걸리게 하는 것이 **목표가 아닙니다.** ` +
      `네이버에서 \`${compound}\` 및 **메인 서비스·유관 검색어**로 찾을 때 공식 홈·블로그가 연결되고, ` +
      `엉뚱한 정보·경쟁사 결과로 새지 않게 하는 것이 목표입니다. ` +
      `HTML 가이드 준수는 수단이고, **브랜드 = 메인 서비스 신호 정렬**이 목표입니다. ` +
      `(패턴: before_after.md · 서브온 ‘서브온 병원동행’ 사례)`,
  );
  lines.push(``);

  lines.push(`### 9-0. 목표 · 문제 · 전략 (Why)`);
  lines.push(``);
  lines.push(`| 항목 | 내용 |`);
  lines.push(`| --- | --- |`);
  lines.push(
    `| 브랜드–메인서비스 연결 강도 | **${bv.bindingScore}점 · ${bv.level}** |`,
  );
  lines.push(`| 메인 서비스 (검색 단위) | **${p.primaryService}** → 검증 쿼리 \`${compound}\` |`);
  lines.push(
    `| 유관 키워드 | ${p.supportingTerms.length ? p.supportingTerms.join(", ") : "(입력·페이지에서 추가 권장)"} |`,
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
  lines.push(
    `**① ‘${compound}’가 최우선 KPI**입니다. 회사명 단독 검색만 보고 판단하지 마세요.`,
  );
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
    `기술 점검(robots·사이트맵)과 별개로, **위 쿼리 — 특히 ‘${compound}’ — 의 실제 결과 화면**이 성공 KPI입니다.`,
  );
  lines.push(``);

  lines.push(`### 9-3. 왜 title · meta · H1인가 (메인 서비스 검색 관점)`);
  lines.push(``);
  lines.push(`| 신호 원천 | ‘${compound}’·유관 검색에 미치는 영향 |`);
  lines.push(`| --- | --- |`);
  lines.push(
    `| title | 파란 제목. 브랜드+메인서비스가 한 단위로 안 보이면 회사 홈이 서비스 검색과 안 묶임 |`,
  );
  lines.push(
    `| meta description | 회색 설명. ‘${p.brand}=${p.primaryService} 전문’ 한 줄이 정체성 전달 |`,
  );
  lines.push(
    `| H1 | 페이지 주제. 인증 배지가 H1이면 엔진이 메인 서비스를 주제로 못 읽음 (핵심 실패 모드) |`,
  );
  lines.push(
    `| 본문 앞 텍스트 | 이미지 카피만 있으면 서비스·유관 키워드 보강 실패 |`,
  );
  lines.push(
    `| 채널(블로그·플레이스) | 홈만 고치고 채널 메시지가 다르면 ‘${compound}’ 클러스터가 분산 |`,
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

  lines.push(`### 9-5. 신호 매트릭스 (회사+서비스 · 유관어)`);
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
    `○=존재 △=부분 ×=없음. **title에만 ○이고 H1이 ×이면** ‘단어는 있는데 주제 신호가 약한’ before_after 전형입니다. ` +
      `**‘${compound}’ 행이 ×이면** 회사+서비스 검색 연결이 특히 취약합니다.`,
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

  lines.push(`### 9-7. Before → After 문안 (메인 서비스 검색 강화용)`);
  lines.push(``);
  lines.push(
    `웹/대행사 즉시 반영 초안 (before_after.md 문안 패턴 일반화). ` +
      `게시 전 과장·공공 오인 검수. 각 변경이 **‘${compound}’·유관 검색**에 주는 효과를 함께 적었습니다.`,
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
    lines.push(`- **검색 연결 효과:** ${ba.brandSearchWhy}`);
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
  lines.push(
    `‘${compound}’ 또는 유관 검색 결과에 가까워지길 기대하는 방향 예시입니다.`,
  );
  lines.push(``);
  lines.push(`\`\`\``);
  lines.push(p.snippetPreview.title);
  lines.push(p.snippetPreview.url);
  lines.push(p.snippetPreview.description);
  lines.push(`\`\`\``);
  lines.push(``);

  lines.push(`### 9-9. 실행 체크리스트 (메인 서비스 검색 KPI)`);
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
      `기술 통과만으로 ‘${compound}’ 검색 연결이 해결되지 않으며, 본 섹션의 신호 정렬이 비즈니스 목표에 직결됩니다.`,
  );
  lines.push(``);

  return lines.join("\n");
}
