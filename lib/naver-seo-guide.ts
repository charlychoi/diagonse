/**
 * Naver Search Advisor (서치어드바이저) webmaster guide — operational checklist.
 *
 * Source: https://searchadvisor.naver.com/guide
 * Guides codified (non-exhaustive): seo-basic-*, markup-*, content-*, structured-data-*,
 * request-feed, indexnow-about, faq-serp*, seo-advanced-*
 *
 * Official principle: guidelines help discovery & indexing; ranking is not guaranteed.
 * Yeti is Naver's crawler User-Agent.
 */

import type { ParsedSiteSignals } from "./crawl";
import type { DiagnosisInput } from "./types";

export const NAVER_GUIDE_BASE = "https://searchadvisor.naver.com/guide";

export type NaverCheckStatus = "pass" | "warn" | "fail" | "manual";

export type NaverCheckItem = {
  id: string;
  category: string;
  title: string;
  status: NaverCheckStatus;
  detail: string;
  action: string;
  guideUrl: string;
  guideTitle: string;
};

export type NaverSeoReport = {
  source: string;
  score: number; // 0–100 from auto-evaluable checks only
  pass: number;
  warn: number;
  fail: number;
  manual: number;
  items: NaverCheckItem[];
  topActions: string[];
  disclaimer: string;
  markdown: string;
};

function guide(path: string): string {
  return `${NAVER_GUIDE_BASE}/${path}`;
}

function titleLen(title: string | null): number {
  return (title || "").trim().length;
}

function hasKeywordStuffing(text: string | null): boolean {
  if (!text) return false;
  // 2+ consecutive same multi-char token (Naver warns 2회 이상 반복)
  const tokens = text
    .toLowerCase()
    .split(/[\s|/·,，]+/)
    .filter((t) => t.length >= 2);
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] === tokens[i + 1]) return true;
  }
  // same 2+ char word 3+ times
  const counts = new Map<string, number>();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) || 0) + 1);
    if ((counts.get(t) || 0) >= 3 && t.length >= 2) return true;
  }
  return false;
}

/**
 * Evaluate site HTML signals against Naver webmaster guidelines.
 */
export function evaluateNaverSeo(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
): NaverSeoReport {
  const items: NaverCheckItem[] = [];
  const push = (item: NaverCheckItem) => items.push(item);

  // --- Discovery / robots / crawl ---
  push({
    id: "yeti-robots",
    category: "수집·발견",
    title: "robots.txt로 Yeti(네이버 검색로봇) 접근 허용",
    status: "manual",
    detail:
      "네이버 검색로봇 User-Agent는 Yeti입니다. 루트 robots.txt에서 차단되면 수집·색인이 불가합니다. (파일 없으면 전체 수집 가능으로 간주)",
    action:
      "https://{도메인}/robots.txt 확인 → User-agent: Yeti 또는 * 에 Allow: / . 관리·개인정보 경로만 Disallow.",
    guideUrl: guide("seo-basic-robots"),
    guideTitle: "robots.txt 설정하기",
  });

  const robotsContent = signals.robotsMetaContent?.toLowerCase() ?? "";
  if (robotsContent.includes("noindex")) {
    push({
      id: "meta-noindex",
      category: "수집·발견",
      title: "robots 메타 noindex 미사용 (메인)",
      status: "fail",
      detail: `메인 HTML에 robots noindex가 감지됨: "${signals.robotsMetaContent}" — 검색 결과에서 제외됩니다.`,
      action:
        "공개 메인이라면 meta robots noindex 제거 또는 index,follow 로 변경. (markup-structure)",
      guideUrl: guide("markup-structure"),
      guideTitle: "선호 URL 및 로봇 메타 태그",
    });
  } else {
    push({
      id: "meta-noindex",
      category: "수집·발견",
      title: "robots 메타 noindex 미사용 (메인)",
      status: "pass",
      detail: signals.hasRobotsMeta
        ? `robots 메타 존재: ${signals.robotsMetaContent || "(파싱됨)"} — noindex 아님`
        : "robots 메타 없음 — 기본은 색인 허용으로 해석 (권장: 필요 시 index,follow 명시)",
      action: "특별한 제약 없으면 삭제 또는 index,follow 유지.",
      guideUrl: guide("markup-structure"),
      guideTitle: "선호 URL 및 로봇 메타 태그",
    });
  }

  if (signals.canonical) {
    const isAbs = /^https?:\/\//i.test(signals.canonical);
    push({
      id: "canonical",
      category: "수집·발견",
      title: "canonical(선호 URL) 절대경로 지정",
      status: isAbs ? "pass" : "warn",
      detail: isAbs
        ? `canonical: ${signals.canonical}`
        : `canonical이 상대경로일 수 있음: ${signals.canonical} — 절대경로 권장`,
      action:
        "동일 콘텐츠 다중 URL 시 link rel=canonical 절대 URL. 메인은 가능하면 301로 대표 호스트 통일.",
      guideUrl: guide("markup-structure"),
      guideTitle: "선호 URL 및 로봇 메타 태그",
    });
  } else {
    push({
      id: "canonical",
      category: "수집·발견",
      title: "canonical(선호 URL) 절대경로 지정",
      status: "warn",
      detail: "canonical 링크 미검출 — www/non-www·파라미터 중복 시 대표 URL이 흔들릴 수 있음",
      action:
        "대표 URL로 301 또는 rel=canonical 절대경로 지정. (seo-basic-create)",
      guideUrl: guide("seo-basic-create"),
      guideTitle: "웹 사이트를 만들 때",
    });
  }

  push({
    id: "https",
    category: "수집·발견",
    title: "HTTPS 제공",
    status: signals.https ? "pass" : "fail",
    detail: signals.https
      ? "HTTPS로 접속됨"
      : "비HTTPS — 신뢰·수집·리다이렉트 정책에 불리할 수 있음",
    action: "SSL 적용 후 http→https 301.",
    guideUrl: guide("seo-basic-http"),
    guideTitle: "HTTP 규약",
  });

  push({
    id: "sitemap-rss",
    category: "수집·발견",
    title: "사이트맵·RSS를 서치어드바이저에 제출",
    status: signals.hasSitemapHint ? "warn" : "manual",
    detail: signals.hasSitemapHint
      ? "페이지에 sitemap 관련 신호가 있음 — 서치어드바이저 제출 여부는 콘솔에서 확인"
      : "사이트맵/RSS 신호 약함 — 수집 피드 제출을 권장",
    action:
      "XML 사이트맵·RSS 작성 후 https://searchadvisor.naver.com 에 사이트 등록·피드 제출. robots.txt에 Sitemap: 위치 명시 가능.",
    guideUrl: guide("request-feed"),
    guideTitle: "RSS 및 사이트맵 제출",
  });

  push({
    id: "indexnow",
    category: "수집·발견",
    title: "IndexNow로 갱신 페이지 알림 (선택)",
    status: "manual",
    detail:
      "IndexNow는 신규·수정·삭제 URL을 빨리 알리지만 색인을 보장하지 않음 (공식 고지).",
    action: "주요 페이지 배포 시 IndexNow API 연동 검토. (indexnow-about)",
    guideUrl: guide("indexnow-about"),
    guideTitle: "IndexNow 소개",
  });

  // --- HTML markup / content ---
  const tl = titleLen(signals.title);
  if (!signals.title) {
    push({
      id: "title",
      category: "HTML 마크업",
      title: "title 태그 — 브랜드·고유명사 중심",
      status: "fail",
      detail: "title 없음 — 검색 결과 제목 후보 부재",
      action:
        "메인 title에 상호·서비스 등 고유명사. 과도한 길이·키워드 나열·잦은 변경 금지. (markup-content)",
      guideUrl: guide("markup-content"),
      guideTitle: "콘텐츠 마크업",
    });
  } else if (tl > 60 || hasKeywordStuffing(signals.title)) {
    push({
      id: "title",
      category: "HTML 마크업",
      title: "title 태그 — 브랜드·고유명사 중심",
      status: "warn",
      detail: `title 길이 ${tl}자 또는 반복 키워드 의심: "${signals.title}"`,
      action:
        "검색 결과에 읽히는 길이로 축약. 2회 이상 동일 키워드 반복·스팸성 나열 금지.",
      guideUrl: guide("markup-content"),
      guideTitle: "콘텐츠 마크업",
    });
  } else {
    push({
      id: "title",
      category: "HTML 마크업",
      title: "title 태그 — 브랜드·고유명사 중심",
      status: "pass",
      detail: `title: "${signals.title}"`,
      action: "페이지마다 고유 title 유지. 메인과 하위 페이지 제목 동일화 금지.",
      guideUrl: guide("markup-content"),
      guideTitle: "콘텐츠 마크업",
    });
  }

  if (!signals.description) {
    push({
      id: "description",
      category: "HTML 마크업",
      title: "meta description — 1~2문장 요약",
      status: "warn",
      detail: "description 없음 — 스니펫 후보가 약함 (엔진이 본문에서 추출할 수 있음)",
      action:
        "페이지 내용 요약 1~2문장. 키워드만 나열·전체 본문 복붙·전 페이지 동일 설명 금지.",
      guideUrl: guide("markup-content"),
      guideTitle: "콘텐츠 마크업",
    });
  } else if (
    signals.description.length > 200 ||
    hasKeywordStuffing(signals.description)
  ) {
    push({
      id: "description",
      category: "HTML 마크업",
      title: "meta description — 1~2문장 요약",
      status: "warn",
      detail: `description 과도한 길이(${signals.description.length}자) 또는 반복 키워드 의심`,
      action: "짧게 간추리고 콘텐츠와 일치하는 문구만 사용. (content-basic)",
      guideUrl: guide("content-basic"),
      guideTitle: "콘텐츠 작성시 권장 사항",
    });
  } else {
    push({
      id: "description",
      category: "HTML 마크업",
      title: "meta description — 1~2문장 요약",
      status: "pass",
      detail: `description 길이 ${signals.description.length}자`,
      action: "검색 노출만을 위해 description을 자주 바꾸지 말 것.",
      guideUrl: guide("markup-content"),
      guideTitle: "콘텐츠 마크업",
    });
  }

  if (signals.hasOg) {
    push({
      id: "og",
      category: "HTML 마크업",
      title: "Open Graph (og:title/description/image) 권장",
      status: "pass",
      detail:
        "OG 메타 존재 — 네이버 검색로봇도 페이지 분석·노출에 활용하는 경우가 있음 (공식)",
      action: "og:image는 150×150 이상 권장. title·desc와 취지 일치.",
      guideUrl: guide("markup-content"),
      guideTitle: "콘텐츠 마크업",
    });
  } else {
    push({
      id: "og",
      category: "HTML 마크업",
      title: "Open Graph (og:title/description/image) 권장",
      status: "warn",
      detail: "OG 메타 미검출 — 소셜 공유·일부 검색 분석에 불리할 수 있음",
      action: "og:type, og:title, og:description, og:image, og:url 기입.",
      guideUrl: guide("markup-content"),
      guideTitle: "콘텐츠 마크업",
    });
  }

  if (signals.h1s.length === 0) {
    push({
      id: "h1-text",
      category: "콘텐츠 품질",
      title: "핵심 정보는 텍스트(이미지 카피 최소화)",
      status: "warn",
      detail: "H1 텍스트 없음 — 주제 신호가 약하거나 이미지에만 카피가 있을 수 있음",
      action:
        "핵심 문장을 HTML 텍스트로. 이미지 사용 시 alt에 필요한 정보만 (과도한 alt는 스팸 오인).",
      guideUrl: guide("content-basic"),
      guideTitle: "콘텐츠 작성시 권장 사항",
    });
  } else if (
    /예비사회적기업|로고|logo|인증/i.test(signals.h1s[0]) &&
    input.keywords?.[0] &&
    !signals.h1s[0].includes(input.keywords[0])
  ) {
    push({
      id: "h1-text",
      category: "콘텐츠 품질",
      title: "핵심 정보는 텍스트(이미지 카피 최소화)",
      status: "warn",
      detail: `H1이 서비스 주제보다 인증/로고성: "${signals.h1s[0]}"`,
      action: "H1을 페이지 주제(서비스)로, 배지는 H1 밖 텍스트 영역으로.",
      guideUrl: guide("content-basic"),
      guideTitle: "콘텐츠 작성시 권장 사항",
    });
  } else {
    push({
      id: "h1-text",
      category: "콘텐츠 품질",
      title: "핵심 정보는 텍스트(이미지 카피 최소화)",
      status: "pass",
      detail: `H1 텍스트 확인: "${signals.h1s[0]}"`,
      action: "히어로 핵심도 텍스트 선택 가능하게 유지.",
      guideUrl: guide("content-basic"),
      guideTitle: "콘텐츠 작성시 권장 사항",
    });
  }

  const altRatio =
    signals.imageCount > 0
      ? signals.imagesWithAlt / signals.imageCount
      : 1;
  if (signals.imageCount > 3 && altRatio < 0.4) {
    push({
      id: "img-alt",
      category: "콘텐츠 품질",
      title: "이미지 alt — 필요 정보 중심",
      status: "warn",
      detail: `이미지 ${signals.imageCount}개 중 alt 있는 것 ${signals.imagesWithAlt}개 (비율 ${Math.round(altRatio * 100)}%)`,
      action: "카피 이미지에 의미 있는 짧은 alt. 장식은 alt=\"\". 과장·키워드 나열 alt 금지.",
      guideUrl: guide("content-basic"),
      guideTitle: "콘텐츠 작성시 권장 사항",
    });
  } else {
    push({
      id: "img-alt",
      category: "콘텐츠 품질",
      title: "이미지 alt — 필요 정보 중심",
      status: signals.imageCount === 0 ? "manual" : "pass",
      detail:
        signals.imageCount === 0
          ? "이미지 적음 — 수동 확인"
          : `alt 커버리지 약 ${Math.round(altRatio * 100)}%`,
      action: "빈 alt로 카피 이미지를 숨기지 말 것.",
      guideUrl: guide("content-basic"),
      guideTitle: "콘텐츠 작성시 권장 사항",
    });
  }

  push({
    id: "mobile",
    category: "HTML 마크업",
    title: "모바일 사용성 (viewport·반응형)",
    status: signals.hasViewport ? "pass" : "fail",
    detail: signals.hasViewport
      ? "viewport 메타 존재"
      : "viewport 없음 — 모바일 사용성 가이드 미충족 가능",
    action:
      "반응형 권장. 별도 모바일 URL이면 데스크톱↔모바일 대응 link 명시 + 양쪽 서치어드바이저 등록.",
    guideUrl: guide("markup-mobile"),
    guideTitle: "모바일 사용성",
  });

  push({
    id: "favicon",
    category: "HTML 마크업",
    title: "파비콘 (정사각·최소 16px)",
    status: signals.hasFavicon ? "pass" : "warn",
    detail: signals.hasFavicon
      ? "favicon 링크 신호 있음 — 사이즈·robots 수집 가능 여부는 콘솔 확인"
      : "favicon 미검출 — 검색 결과 아이콘 노출에 불리할 수 있음",
    action:
      "고유 파비콘, URL 잦은 변경 금지, robots로 차단하지 말 것. (markup-favicon)",
    guideUrl: guide("markup-favicon"),
    guideTitle: "파비콘 (Favicon)",
  });

  // Structured data
  if (signals.hasJsonLd || signals.hasSchemaOrg) {
    push({
      id: "jsonld",
      category: "구조화 데이터",
      title: "구조화된 데이터 (schema.org) 마크업",
      status: "pass",
      detail:
        "JSON-LD/Schema 신호 있음 — 정상 마크업이어도 검색 반영은 보장되지 않음 (공식)",
      action:
        "Organization 등 사실과 일치하는 타입만. 연관채널 구조화 데이터 검토. (structured-data-channel)",
      guideUrl: guide("structured-data-intro"),
      guideTitle: "구조화된 데이터 소개",
    });
  } else {
    push({
      id: "jsonld",
      category: "구조화 데이터",
      title: "구조화된 데이터 (schema.org) 마크업",
      status: "warn",
      detail: "구조화 데이터 미검출",
      action:
        "Organization / LocalBusiness / Breadcrumb 등 페이지 특성에 맞는 JSON-LD 추가.",
      guideUrl: guide("structured-data-intro"),
      guideTitle: "구조화된 데이터 소개",
    });
  }

  push({
    id: "related-channel",
    category: "구조화 데이터",
    title: "사이트 연관채널 구조화 데이터",
    status: signals.socialLinks.length > 0 ? "warn" : "manual",
    detail:
      signals.socialLinks.length > 0
        ? `소셜 링크 감지: ${signals.socialLinks.join(", ")} — 구조화 데이터(연관채널) 여부는 별도 확인`
        : "연관 채널 링크·구조화 데이터 확인 필요",
    action:
      "루트 페이지에 사이트-채널 연계 구조화 데이터 기입. 노출 보장 아님. (structured-data-channel)",
    guideUrl: guide("structured-data-channel"),
    guideTitle: "사이트 연관채널",
  });

  // Content quality / abuse (manual + light heuristics)
  push({
    id: "no-abuse",
    category: "콘텐츠 품질",
    title: "어뷰징 금지 (키워드 반복·낚시·대량 저품질)",
    status: hasKeywordStuffing(signals.title) || hasKeywordStuffing(signals.description)
      ? "warn"
      : "manual",
    detail:
      "동일 키워드 과다 반복, 내용 무관 인기 검색어, 템플릿 대량 양산, AI 단순 복붙은 품질 불이익 대상 (content-abusing)",
    action:
      "전문성·경험·일관 주제·진정성·가독 구조 5원칙 준수. (content-basic)",
    guideUrl: guide("content-abusing"),
    guideTitle: "웹 콘텐츠 스팸사례",
  });

  push({
    id: "spa-js",
    category: "고급",
    title: "JS/SPA 시 본문 HTML 확보",
    status: signals.wordCount < 80 && signals.pageCountCrawled > 0 ? "warn" : "manual",
    detail:
      signals.wordCount < 80 && signals.pageCountCrawled > 0
        ? `본문 텍스트 약 ${signals.wordCount}단어 — 빈 HTML·클라이언트 렌더만 있으면 색인 불용 문서 위험 (seo-advanced-indexing)`
        : "SPA/CSR 사이트는 서버 렌더 또는 프리렌더로 본문 확보 권장",
    action:
      "중요 콘텐츠가 초기 HTML에 포함되도록. 수집된 문서 ≠ 전부 색인. (seo-advanced-javascript)",
    guideUrl: guide("seo-advanced-javascript"),
    guideTitle: "자바스크립트 검색 최적화",
  });

  push({
    id: "register-console",
    category: "운영",
    title: "서치어드바이저 사이트 등록·URL 검사",
    status: "manual",
    detail:
      "소유확인 후 수집 현황·사이트 진단·URL 검사로 미노출 원인 확인 (faq-serpmissing)",
    action:
      "https://searchadvisor.naver.com 등록 → 사이트맵 제출 → 수정 후 URL 검사/재수집.",
    guideUrl: guide("faq-start-register"),
    guideTitle: "사이트 등록 및 소유확인",
  });

  // Score: only pass/warn/fail (manual excluded)
  let got = 0;
  let avail = 0;
  for (const it of items) {
    if (it.status === "manual") continue;
    avail += 1;
    if (it.status === "pass") got += 1;
    else if (it.status === "warn") got += 0.5;
  }
  const score = avail ? Math.round((got / avail) * 100) : 0;
  const pass = items.filter((i) => i.status === "pass").length;
  const warn = items.filter((i) => i.status === "warn").length;
  const fail = items.filter((i) => i.status === "fail").length;
  const manual = items.filter((i) => i.status === "manual").length;

  const topActions = items
    .filter((i) => i.status === "fail" || i.status === "warn")
    .slice(0, 6)
    .map((i) => `[${i.category}] ${i.title}: ${i.action}`);

  const disclaimer =
    "본 체크리스트는 네이버 서치어드바이저 웹마스터 가이드(https://searchadvisor.naver.com/guide)를 요약한 **기술·수집 전제** 점검입니다. " +
    "robots·canonical·title 형식 준수는 필요 조건이지, 브랜드 검색 시 ‘무슨 회사인지’가 보이게 하는 전략 전체는 아닙니다. " +
    "브랜드=서비스 신호 정렬·실검색 KPI는 보고서의 「브랜드 검색 노출 전략(Before→After)」을 따르십시오. " +
    "가이드 준수가 상위 노출을 보장하지 않으며, 최종 확인은 서치어드바이저 콘솔·실검색 화면으로 하십시오.";

  const report: Omit<NaverSeoReport, "markdown"> = {
    source: NAVER_GUIDE_BASE,
    score,
    pass,
    warn,
    fail,
    manual,
    items,
    topActions,
    disclaimer,
  };

  return { ...report, markdown: formatNaverMarkdown(report) };
}

export function formatNaverMarkdown(r: Omit<NaverSeoReport, "markdown">): string {
  const statusKo = (s: NaverCheckStatus) =>
    s === "pass" ? "통과" : s === "warn" ? "주의" : s === "fail" ? "미흡" : "수동확인";
  const lines: string[] = [];
  lines.push(`## 네이버 서치어드바이저 가이드 점검 (기술 전제)`);
  lines.push(``);
  lines.push(
    `> 출처: [네이버 서치어드바이저 웹마스터 가이드](${r.source}) · 자동 점검 점수 **${r.score}/100** (통과 ${r.pass} · 주의 ${r.warn} · 미흡 ${r.fail} · 수동 ${r.manual})`,
  );
  lines.push(``);
  lines.push(
    `> **역할 구분:** 이 섹션 = 수집·색인 **가능 환경**(robots, canonical, title 형식 등). ` +
      `브랜드 검색 시 기업이 안 보이는 문제 해결 = 별도 「브랜드 검색 노출 전략」 섹션. 둘 다 필요합니다.`,
  );
  lines.push(``);
  lines.push(r.disclaimer);
  lines.push(``);
  lines.push(`### 카테고리별 점검 결과`);
  lines.push(``);
  lines.push(`| 상태 | 항목 | 관찰 | 조치 | 공식 가이드 |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  for (const it of r.items) {
    lines.push(
      `| ${statusKo(it.status)} | **${it.title}** (${it.category}) | ${it.detail.replace(/\|/g, "/")} | ${it.action.replace(/\|/g, "/")} | [${it.guideTitle}](${it.guideUrl}) |`,
    );
  }
  lines.push(``);
  if (r.topActions.length) {
    lines.push(`### 우선 조치 (가이드 정렬)`);
    lines.push(``);
    r.topActions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
    lines.push(``);
  }
  lines.push(`### 운영 루틴 (공식 권장 흐름)`);
  lines.push(``);
  lines.push(
    `1. [서치어드바이저](https://searchadvisor.naver.com) 사이트 등록·소유 확인`,
  );
  lines.push(
    `2. robots.txt(Yeti 허용) · 사이트맵/RSS 제출 · ([request-feed](${guide("request-feed")}))`,
  );
  lines.push(
    `3. title·description·OG·canonical·모바일·favicon 마크업 ([markup-content](${guide("markup-content")}))`,
  );
  lines.push(
    `4. 핵심 정보 텍스트화 · 어뷰징 금지 ([content-basic](${guide("content-basic")}) / [content-abusing](${guide("content-abusing")}))`,
  );
  lines.push(
    `5. 구조화 데이터·연관채널 ([structured-data-intro](${guide("structured-data-intro")}))`,
  );
  lines.push(
    `6. 수정 후 URL 검사·재수집 · 미노출 시 robots/noindex/방화벽/중복 URL 점검 ([faq-serpmissing](${guide("faq-serpmissing")}))`,
  );
  lines.push(
    `7. (선택) IndexNow로 갱신 알림 — 색인 보장 아님 ([indexnow-about](${guide("indexnow-about")}))`,
  );
  lines.push(``);
  return lines.join("\n");
}
