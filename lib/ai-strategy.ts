/**
 * AI keyword strategy — the core engine for the product goal:
 * with ONLY homepage URL + company name, design search visibility around
 * the company's MAIN BUSINESS KEYWORDS (not the brand name).
 *
 * Two modes:
 *  - AI mode (Grok 4.5 API): crawled content → Grok → 3-tier keyword
 *    strategy + rewritten title/meta/H1 + FAQ set + blog title plan
 *  - Heuristic fallback (API disabled / failure): content keyword mining from the
 *    crawled body text — never falls back to the company name as a "keyword"
 */

import type { ParsedSiteSignals } from "./crawl";
import { callAi, aiEnabled } from "./ai-provider";
import type { DiagnosisInput } from "./types";

export type KeywordTierItem = {
  keyword: string;
  /** why a customer would type this */
  intent: string;
};

export type FaqItem = { q: string; a: string };

export type KeywordStrategy = {
  source: "ai" | "heuristic";
  model?: string;
  /** one-sentence definition of the main business, inferred from the site */
  mainBusiness: string;
  /** the single keyword customers would pair with the brand */
  primaryService: string;
  /** detected region tokens (for tier-3 local queries), may be empty */
  regions: string[];
  /** 1층 — high-intent conversion keywords (짧고 경쟁 높음) */
  tier1: KeywordTierItem[];
  /** 2층 — situation/need keywords (실제 승부처: 고객이 검색창에 치는 문장) */
  tier2: KeywordTierItem[];
  /** 3층 — region / B2B keywords */
  tier3: KeywordTierItem[];
  /** rewritten on-page signals (After安) */
  titleAfter: string;
  metaAfter: string;
  h1After: string;
  /** FAQ set for AI-search (네이버 AI 브리핑·생성형 AI 인용) 대비 */
  faqs: FaqItem[];
  /** blog titles matched to tier-2 keywords */
  blogTitles: string[];
  /** honest notes about how this was produced / its limits */
  notes: string[];
};

/* ------------------------------------------------------------------ */
/* Content keyword mining (no AI required)                              */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  "있습니다", "합니다", "됩니다", "입니다", "하는", "있는", "위한", "통해", "대한",
  "함께", "제공", "서비스", "회사", "소개", "이용", "안내", "관련", "다양한", "모든",
  "지금", "바로", "무료", "고객", "센터", "문의", "상담", "신청", "확인", "보기",
  "the", "and", "for", "with", "our", "your", "more", "all", "new", "about",
  "contact", "home", "menu", "copyright", "rights", "reserved",
  // 404/오류 페이지·내비게이션 상용구 — 실제 사이트가 아닌 깨진 링크에서 자주 유입됨
  "없습니다", "않습니다", "못합니다", "또는", "그리고", "하지만", "그러나", "디렉토리",
  "페이지", "찾을", "요청하신", "존재하지",
]);

/**
 * HTML/CSS/JS artifacts that leak from JavaScript-rendered pages.
 * Without this filter, sites built with page builders yield junk keywords
 * like "hover", "viewport", "nav" instead of real business terms.
 */
const TECH_TOKENS = new Set([
  "hover", "text", "img", "image", "viewport", "nav", "show", "hide", "click",
  "button", "btn", "div", "span", "class", "style", "color", "background",
  "border", "margin", "padding", "width", "height", "font", "size", "align",
  "flex", "grid", "block", "inline", "none", "auto", "left", "right", "top",
  "bottom", "center", "wrap", "content", "container", "wrapper", "header",
  "footer", "section", "main", "aside", "link", "href", "src", "alt", "title",
  "meta", "html", "body", "head", "script", "https", "http", "www", "com",
  "index", "page", "site", "web", "app", "data", "type", "name", "value",
  "true", "false", "null", "function", "var", "let", "const", "return",
  "active", "open", "close", "toggle", "slide", "fade", "modal", "popup",
  "cookie", "gtag", "google", "analytics", "facebook", "instagram", "naver",
  "kakao", "svg", "png", "jpg", "webp", "icon", "logo", "banner", "slider",
]);

/** A token that looks like a real (Korean) business keyword */
function isBusinessToken(tok: string): boolean {
  const t = tok.trim().toLowerCase();
  if (!t || t.length < 2 || t.length > 20) return false;
  if (STOPWORDS.has(t) || TECH_TOKENS.has(t)) return false;
  // pure ASCII single words are usually UI/tech artifacts on Korean sites;
  // keep them only if they appear inside a Korean bigram (handled elsewhere)
  if (/^[a-z0-9]+$/.test(t)) return false;
  // must contain Hangul to count as a business keyword
  if (!/[가-힣]/.test(tok)) return false;
  return true;
}

/** Strip trailing Korean particles so "경험과"→"경험", "자원이"→"자원" */
function stripParticle(tok: string): string {
  return tok.replace(/(으로|에서|에게|까지|부터|이나|과|와|을|를|이|가|은|는|의|에|도|만|로)$/u, "").trim();
}

/**
 * Abstract mission/slogan words that are NOT searchable service keywords.
 * On JS-rendered builder sites the only crawlable Korean text is often the
 * company slogan; these words must not become "service keywords".
 */
const ABSTRACT_WORDS = new Set([
  "경험", "지혜", "사회혁신", "혁신", "자원", "되도록", "가치", "미래", "함께",
  "행복", "희망", "사랑", "정성", "최고", "최선", "약속", "비전", "미션", "철학",
  "세상", "변화", "성장", "동행", "여정", "이야기", "스토리", "감동", "신뢰",
]);

function cleanToken(tok: string): string | null {
  const parts = tok.split(" ").map(stripParticle).filter(Boolean);
  if (!parts.length) return null;
  const joined = parts.join(" ");
  // drop if every part is an abstract slogan word
  if (parts.every((p) => ABSTRACT_WORDS.has(p))) return null;
  if (joined.length < 2) return null;
  return joined;
}

function tokenize(text: string): string[] {
  return (text || "")
    .replace(/[^가-힣a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(
      (t) =>
        t.length >= 2 &&
        t.length <= 20 &&
        !STOPWORDS.has(t.toLowerCase()) &&
        !TECH_TOKENS.has(t.toLowerCase()),
    );
}

/**
 * Mine candidate business keywords from crawled content.
 * Headings/title/description are weighted over body text; the brand name is
 * excluded — the whole point is to surface NON-brand keywords.
 */
export function extractContentKeywords(
  signals: ParsedSiteSignals,
  bodyText: string,
  brand: string,
  limit = 15,
): string[] {
  const freq = new Map<string, number>();
  const bump = (tok: string, w: number) => {
    if (!tok) return;
    const key = tok.toLowerCase();
    if (brand && (key.includes(brand.toLowerCase()) || brand.toLowerCase().includes(key))) return;
    freq.set(key, (freq.get(key) ?? 0) + w);
  };

  const weighted: Array<[string | null, number]> = [
    [signals.title, 5],
    [signals.description, 4],
    [signals.h1s.join(" "), 5],
    [signals.h2s.join(" "), 3],
    [bodyText.slice(0, 8000), 1],
  ];
  for (const [text, w] of weighted) {
    if (!text) continue;
    const toks = tokenize(text);
    for (const t of toks) bump(t, w);
    // adjacent Korean bigrams ("병원 동행" → "병원 동행")
    for (let i = 0; i < toks.length - 1; i++) {
      if (/[가-힣]/.test(toks[i]) && /[가-힣]/.test(toks[i + 1])) {
        bump(`${toks[i]} ${toks[i + 1]}`, w + 1);
      }
    }
  }

  // Keep only business-like tokens: Korean unigrams/bigrams, drop tech/ASCII junk
  const ranked = [...freq.entries()]
    .filter(([k]) => {
      if (k.includes(" ")) {
        // bigram: both parts must be Korean and non-tech
        return k.split(" ").every((p) => /[가-힣]/.test(p) && !TECH_TOKENS.has(p));
      }
      return isBusinessToken(k);
    })
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  // clean particles / drop slogan-only fragments, dedupe, prefer bigrams
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const k of ranked) {
    const c = cleanToken(k);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    cleaned.push(c);
  }
  return cleaned
    .sort((a, b) => Number(b.includes(" ")) - Number(a.includes(" ")))
    .slice(0, limit);
}

const REGION_RE =
  /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[\s]?([가-힣]{1,6}(?:시|구|군))?/g;

export function extractRegions(bodyText: string, limit = 3): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(REGION_RE);
  while ((m = re.exec(bodyText)) !== null && found.size < limit * 3) {
    found.add((m[2] ? `${m[2]}` : m[1]).trim());
  }
  return [...found].slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Heuristic strategy (fallback)                                        */
/* ------------------------------------------------------------------ */

function heuristicService(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
  mined: string[],
): string {
  if (input.keywords?.[0]) return input.keywords[0];
  if (signals.title) {
    const segs = signals.title.split(/[|·\-–—]/).map((s) => s.trim()).filter(Boolean);
    for (let i = 1; i < segs.length; i++) {
      const cleaned = segs[i].replace(/서비스|전문|공식|홈페이지/g, " ").replace(/\s+/g, " ").trim();
      // must be a Korean business phrase, not an English/tech segment
      if (cleaned.length >= 2 && cleaned.length <= 24 && /[가-힣]/.test(cleaned) && !TECH_TOKENS.has(cleaned.toLowerCase())) {
        return cleaned;
      }
    }
  }
  if (input.industry?.trim()) return input.industry.trim().split(/[·,/]/)[0].trim();
  // mined is already business-filtered & particle-cleaned; take the first
  const minedKo = mined.find((m) => /[가-힣]/.test(m));
  if (minedKo) return minedKo;
  return "핵심 서비스";
}

/** True when the crawl yielded almost no real service content (JS-rendered / thin) */
function isThinContent(signals: ParsedSiteSignals, mined: string[]): boolean {
  const bodyKo = (signals.bodyText || "").replace(/[^가-힣]/g, "").length;
  return bodyKo < 200 || mined.length < 2;
}

export function buildHeuristicStrategy(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
  bodyText: string,
): KeywordStrategy {
  const brand = (input.company || "").trim() || signals.hostname.split(".")[0];
  const mined = extractContentKeywords(signals, bodyText, brand);
  const thin = isThinContent(signals, mined) && !input.keywords?.length && !input.industry;
  const service = heuristicService(signals, input, mined);
  const regions = extractRegions(bodyText);
  const region = regions[0] ?? "";

  const tier2Base = mined
    .filter((k) => k !== service && !service.includes(k) && !k.includes(service))
    .slice(0, 3)
    .map((k) => ({
      keyword: k,
      intent: "홈페이지 본문에서 발견된 주제 후보 — 실제 서비스명으로 교체·검증 필요",
    }));

  return {
    source: "heuristic",
    mainBusiness: signals.description?.slice(0, 80) || `${service} 관련 사업(홈 메타 기반 추정)`,
    primaryService: service,
    regions,
    tier1: [
      { keyword: service, intent: "지금 바로 업체를 찾는 핵심 전환 검색" },
      { keyword: `${service} 비용`, intent: "가격 비교 단계의 구매 직전 검색" },
      { keyword: `${service} 추천`, intent: "업체 선정 단계 검색" },
    ],
    tier2: [
      { keyword: `${service} 신청 방법`, intent: "이용 절차를 묻는 정보형 검색" },
      { keyword: `${service} 후기`, intent: "신뢰 확인 단계 검색" },
      ...tier2Base,
    ].slice(0, 8),
    tier3: [
      ...(region ? [{ keyword: `${region} ${service}`, intent: "지역 기반 검색 (플레이스 연동)" }] : []),
      { keyword: `기업 ${service}`, intent: "B2B·제휴 담당자 검색" },
    ].slice(0, 3),
    titleAfter: `${brand} | ${service} 전문`,
    metaAfter: `${brand}는 ${service} 전문 서비스입니다. ${regions.length ? regions.join("·") + " 지역 " : ""}상담 문의 환영.`,
    h1After: `${brand} ${service} 서비스`,
    faqs: [
      { q: `${service} 신청은 어떻게 하나요?`, a: "홈페이지 또는 전화·카카오 채널로 상담 후 신청할 수 있습니다. (실제 절차로 교체하세요)" },
      { q: `${service} 비용은 얼마인가요?`, a: "서비스 범위에 따라 다르며 상담 시 안내합니다. (실제 요금 기준으로 교체하세요)" },
      { q: `어느 지역에서 이용할 수 있나요?`, a: regions.length ? `${regions.join(", ")} 등에서 이용 가능합니다. (실제 지역으로 교체)` : "이용 가능 지역을 명시하세요." },
      { q: `상담은 어디로 하면 되나요?`, a: "홈페이지 문의 폼·전화·카카오 채널을 이용해 주세요. (실제 채널로 교체하세요)" },
    ],
    blogTitles: [
      `${service} 신청 전 확인해야 할 3가지`,
      `${service} 비용, 어떻게 정해지나요?`,
      `${service} 실제 이용 후기와 절차`,
      ...(region ? [`${region}에서 ${service} 이용하는 방법`] : []),
    ],
    notes: [
      thin
        ? "⚠ 이 홈페이지는 자바스크립트로 렌더링되어 크롤 가능한 본문이 거의 없습니다. 아래 키워드는 제목·슬로건에서 추정한 것이라 실제 서비스와 다를 수 있습니다. 핵심 키워드를 직접 입력해 주세요."
        : "세부 키워드는 본문 빈출 키워드 기반 휴리스틱으로 생성했습니다.",
      "키워드별 월간 검색량·경쟁도는 네이버 검색광고 키워드 도구에서 실측 후 확정하세요.",
    ],
  };
}

/* ------------------------------------------------------------------ */
/* AI strategy (Grok 4.5 API)                                           */
/* ------------------------------------------------------------------ */

function buildPrompt(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
  bodyText: string,
  mined: string[],
  regions: string[],
): string {
  const brand = (input.company || "").trim();
  return `당신은 15년차 한국 검색(네이버·구글) SEO 컨설턴트입니다.
목표: 이 회사가 "회사명 검색"이 아니라 "핵심 비즈니스 키워드 검색"에서 노출되도록 하는 키워드 전략을 설계하십시오.
고객이 실제 검색창에 입력할 문구(상황·니즈형)를 중심으로 하고, 확인되지 않은 사실은 지어내지 마십시오.

[회사 정보]
- 회사명: ${brand}
- 홈페이지: ${signals.url}
- 업종(선택 입력): ${input.industry || "미입력"}
- 사용자 입력 키워드: ${input.keywords?.join(", ") || "없음"}

[크롤 결과]
- title: ${signals.title || "(없음)"}
- meta description: ${signals.description || "(없음)"}
- H1: ${signals.h1s.join(" / ") || "(없음)"}
- H2(일부): ${signals.h2s.slice(0, 10).join(" / ") || "(없음)"}
- 본문 발췌: ${bodyText.slice(0, 2500)}
- 본문 빈출 키워드(참고): ${mined.join(", ")}
- 감지된 지역: ${regions.join(", ") || "없음"}

[출력 — JSON만, 다른 텍스트 금지]
{
  "mainBusiness": "이 회사의 메인 비즈니스 한 문장 정의",
  "primaryService": "고객이 브랜드와 함께 검색할 핵심 서비스 키워드 1개 (예: 병원동행)",
  "tier1": [{"keyword": "핵심 전환 키워드", "intent": "검색 의도"} — 3개, 짧고 경쟁 높은 키워드],
  "tier2": [{"keyword": "상황·니즈형 키워드(고객이 치는 문장)", "intent": "검색 의도"} — 6~8개, 단기 승부처],
  "tier3": [{"keyword": "지역/B2B 키워드", "intent": "검색 의도"} — 3개],
  "titleAfter": "홈 title 개선안 — '브랜드 | 핵심서비스 …' 형태, 40자 이내",
  "metaAfter": "meta description 개선안 — 80~140자, 핵심 키워드 2~3개 자연 포함",
  "h1After": "첫 화면 H1 개선안 — 텍스트, 서비스명 포함",
  "faqs": [{"q": "질문", "a": "답변 (사이트에서 확인된 사실만, 미확인은 '(확인 후 기재)')"} — 8개, AI 검색·네이버 AI 브리핑이 인용할 질문형],
  "blogTitles": ["tier2 키워드와 1:1 매칭되는 블로그 글 제목" — 10개, 키워드가 제목 앞부분에 오게],
  "notes": ["전략 근거·주의점 2~3개"]
}`;
}

async function callGrokApi(prompt: string): Promise<KeywordStrategy | null> {
  try {
    const result = await callAi(prompt, { webSearch: false });
    const parsed = parseStrategyJson(result.output);
    if (!parsed) return null;
    return { ...parsed, source: "ai", model: result.model };
  } catch {
    return null;
  }
}

export function parseStrategyJson(
  text: string,
): Omit<KeywordStrategy, "source" | "model" | "regions"> & { regions: string[] } | null {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    const tier = (arr: unknown): KeywordTierItem[] =>
      Array.isArray(arr)
        ? arr
            .map((x) =>
              typeof x === "string"
                ? { keyword: x, intent: "" }
                : { keyword: String((x as Record<string, unknown>)?.keyword ?? ""), intent: String((x as Record<string, unknown>)?.intent ?? "") },
            )
            .filter((x) => x.keyword)
        : [];
    if (!obj.primaryService || !tier(obj.tier2).length) return null;
    return {
      mainBusiness: String(obj.mainBusiness ?? ""),
      primaryService: String(obj.primaryService),
      regions: [],
      tier1: tier(obj.tier1),
      tier2: tier(obj.tier2),
      tier3: tier(obj.tier3),
      titleAfter: String(obj.titleAfter ?? ""),
      metaAfter: String(obj.metaAfter ?? ""),
      h1After: String(obj.h1After ?? ""),
      faqs: Array.isArray(obj.faqs)
        ? obj.faqs.map((f: Record<string, unknown>) => ({ q: String(f?.q ?? ""), a: String(f?.a ?? "") })).filter((f: FaqItem) => f.q)
        : [],
      blogTitles: Array.isArray(obj.blogTitles) ? obj.blogTitles.map(String) : [],
      notes: Array.isArray(obj.notes) ? obj.notes.map(String) : [],
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Entry point                                                          */
/* ------------------------------------------------------------------ */

export async function buildKeywordStrategy(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
  bodyText: string,
): Promise<KeywordStrategy> {
  const brand = (input.company || "").trim() || signals.hostname.split(".")[0];
  const mined = extractContentKeywords(signals, bodyText, brand);
  const regions = extractRegions(bodyText);

  const ai = process.env.AI_KEYWORD_STRATEGY === "true" && aiEnabled()
    ? await callGrokApi(buildPrompt(signals, input, bodyText, mined, regions))
    : null;
  if (ai) {
    ai.regions = regions;
    if (!ai.notes.length) ai.notes = [];
    ai.notes.push("키워드별 월간 검색량·경쟁도는 네이버 검색광고 키워드 도구에서 실측 후 확정하세요.");
    return ai;
  }
  return buildHeuristicStrategy(signals, input, bodyText);
}

/** FAQPage JSON-LD from the FAQ set — paste-ready structured data */
export function buildFaqJsonLd(faqs: FaqItem[]): string {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.slice(0, 10).map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    null,
    2,
  );
}
