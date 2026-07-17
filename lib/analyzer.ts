import type { ParsedSiteSignals } from "./crawl";
import { crawlAndParse } from "./crawl";
import { buildMarkdownReport } from "./report";
import { evaluateNaverSeo } from "./naver-seo-guide";
import { evaluateLocalSeo } from "./local-seo";
import { buildSearchMeasureBundle } from "./search-measure";
import { buildSeoPlaybook } from "./seo-playbook";
import { buildKeywordStrategy } from "./ai-strategy";
import {
  finalizeSurfaceScore,
  gradeFromScore,
  SURFACE_SCORE,
  STRUCTURE_SCORE,
} from "./score-reliability";
import type {
  AxisScore,
  DiagnosisAxisKey,
  DiagnosisInput,
  DiagnosisResult,
  QuickWin,
  RoadmapItem,
} from "./types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function keywordHits(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((k) => k && lower.includes(k.toLowerCase()));
}

function scoreBrand(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
): AxisScore {
  // Lower floor than v1 — surface meta alone must not start near "B"
  let score = 14;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const findings: string[] = [];
  const recommendations: string[] = [];

  if (signals.title) {
    score += 10;
    strengths.push(`명확한 페이지 타이틀: "${signals.title}"`);
  } else {
    weaknesses.push("홈페이지 <title> 태그가 없거나 비어 있습니다.");
    recommendations.push("브랜드명 + 핵심 가치제안을 담은 title 태그를 설정하세요.");
  }

  if (signals.description && signals.description.length >= 40) {
    score += 8;
    strengths.push("메타 디스크립션이 존재합니다.");
  } else {
    weaknesses.push("메타 디스크립션이 없거나 너무 짧습니다.");
    recommendations.push("검색·SNS 미리보기를 위해 120~160자 디스크립션을 작성하세요.");
  }

  if (signals.h1s.length === 1) {
    score += 10;
    strengths.push(`단일 H1로 포지셔닝이 집중됨: "${signals.h1s[0]}"`);
  } else if (signals.h1s.length > 1) {
    score += 3;
    findings.push(`H1이 ${signals.h1s.length}개입니다. 메시지가 분산될 수 있습니다.`);
    recommendations.push("페이지당 핵심 가치제안을 담은 H1 1개를 유지하세요.");
  } else {
    weaknesses.push("H1 헤딩이 없습니다.");
    recommendations.push("방문자가 3초 안에 이해할 수 있는 H1 가치제안을 추가하세요.");
  }

  if (signals.hasAbout) {
    score += 8;
    strengths.push("소개/About 콘텐츠 신호가 확인됩니다.");
  } else {
    weaknesses.push("브랜드 스토리(About) 페이지/섹션이 약합니다.");
    recommendations.push("신뢰 구축을 위한 About/회사소개 섹션을 강화하세요.");
  }

  if (signals.hasOg) {
    score += 5;
    strengths.push("Open Graph 메타 태그로 브랜드 공유 이미지가 준비되어 있습니다.");
  } else {
    recommendations.push("OG 이미지·타이틀을 설정해 소셜 공유 시 브랜드 인지도를 높이세요.");
  }

  const kws = input.keywords ?? [];
  const hay = [signals.title, signals.description, ...signals.h1s, ...signals.h2s]
    .filter(Boolean)
    .join(" ");
  const hits = keywordHits(hay, kws);
  if (kws.length > 0) {
    if (hits.length > 0) {
      score += Math.min(10, hits.length * 3);
      strengths.push(`입력 키워드 노출: ${hits.join(", ")}`);
    } else {
      score -= 4;
      weaknesses.push("입력한 핵심 키워드가 홈 메시지에 거의 나타나지 않습니다.");
      recommendations.push(
        `랜딩 헤드라인·서브카피에 핵심 키워드(${kws.slice(0, 3).join(", ")})를 자연스럽게 반영하세요.`,
      );
    }
  } else {
    findings.push("키워드 미입력 — 일반 브랜드 신호만 평가 (가산점 없음).");
  }

  if (input.industry) {
    findings.push(`산업 컨텍스트: ${input.industry}`);
    score += 2;
  }

  if (!signals.https) {
    score -= 18;
    weaknesses.push("HTTPS가 아닙니다. 브랜드 신뢰도에 치명적입니다.");
    recommendations.push("SSL 인증서를 적용해 HTTPS로 전환하세요.");
  }

  return finalizeAxis("brand", score, findings, strengths, weaknesses, recommendations);
}

function scoreContentSeo(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
): AxisScore {
  // Content weight is highest in structure scale (D3=25%) — keep surface conservative
  let score = 12;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const findings: string[] = [];
  const recommendations: string[] = [];

  if (signals.title) score += 6;
  if (signals.description) score += 6;
  if (signals.canonical) {
    score += 5;
    strengths.push("Canonical URL이 설정되어 있습니다.");
  } else {
    recommendations.push("중복 콘텐츠 방지를 위해 canonical 링크를 추가하세요.");
  }

  if (signals.hasViewport) score += 3;
  if (signals.lang) {
    score += 3;
    strengths.push(`언어 속성(lang=${signals.lang})이 지정되어 있습니다.`);
  } else {
    recommendations.push("html lang 속성으로 타겟 언어를 명시하세요.");
  }

  if (signals.wordCount >= 800) {
    score += 12;
    strengths.push(`충분한 텍스트 분량(약 ${signals.wordCount}단어)이 확인됩니다.`);
  } else if (signals.wordCount >= 300) {
    score += 6;
    findings.push(`중간 수준 콘텐츠 분량(약 ${signals.wordCount}단어).`);
  } else {
    score -= 2;
    weaknesses.push("크롤된 페이지의 텍스트 분량이 부족합니다.");
    recommendations.push("검색·AI 인용에 도움이 되는 심층 콘텐츠(FAQ, 가이드)를 추가하세요.");
  }

  if (signals.h2s.length >= 3) {
    score += 5;
    strengths.push("H2 구조로 콘텐츠 계층이 잡혀 있습니다.");
  } else {
    recommendations.push("주제별 H2/H3 계층을 구성해 가독성과 SEO를 개선하세요.");
  }

  if (signals.hasBlog) {
    score += 8;
    strengths.push("블로그/콘텐츠 허브 신호가 있습니다.");
  } else {
    score -= 4;
    weaknesses.push("지속적 콘텐츠 발행 허브(블로그)가 약하거나 없습니다.");
    recommendations.push("월 2~4회 타겟 키워드 기반 블로그/인사이트를 발행하세요.");
  }

  if (signals.hasSitemapHint) {
    score += 4;
    strengths.push("Sitemap 관련 신호가 있습니다.");
  } else {
    recommendations.push("XML sitemap을 생성하고 Search Console에 제출하세요.");
  }

  const altRatio =
    signals.imageCount > 0 ? signals.imagesWithAlt / signals.imageCount : 0;
  if (signals.imageCount > 0) {
    if (altRatio >= 0.7) {
      score += 5;
      strengths.push("이미지 alt 텍스트 커버리지가 양호합니다.");
    } else {
      score += 1;
      weaknesses.push(
        `이미지 alt 비율이 낮습니다 (${signals.imagesWithAlt}/${signals.imageCount}).`,
      );
      recommendations.push("모든 의미 있는 이미지에 설명적 alt 텍스트를 추가하세요.");
    }
  }

  findings.push(
    "※ 검색 1페이지 노출·색인율은 HTML만으로 판정 불가 — 6대 D1 실측 필요",
  );

  if (input.targetCountry) {
    findings.push(`타겟 국가: ${input.targetCountry}`);
    if (
      input.targetCountry.match(/한국|korea|kr/i) &&
      signals.lang &&
      !/ko/i.test(signals.lang)
    ) {
      weaknesses.push("타겟이 한국인데 html lang이 한국어가 아닐 수 있습니다.");
    }
  }

  return finalizeAxis(
    "contentSeo",
    score,
    findings,
    strengths,
    weaknesses,
    recommendations,
  );
}

function scoreUxConversion(signals: ParsedSiteSignals): AxisScore {
  // D5 structure is harsh on funnel blocks — surface must not gift 70+ for viewport alone
  let score = 16;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const findings: string[] = [];
  const recommendations: string[] = [];

  if (signals.hasViewport) {
    score += 8;
    strengths.push("모바일 viewport 메타가 설정되어 있습니다.");
  } else {
    score -= 8;
    weaknesses.push("모바일 viewport가 없습니다.");
    recommendations.push("반응형 뷰포트 메타 태그를 추가하세요.");
  }

  if (signals.hasNav) {
    score += 6;
    strengths.push("네비게이션 구조가 확인됩니다.");
  } else {
    weaknesses.push("명확한 nav 구조 신호가 약합니다.");
    recommendations.push("핵심 여정을 안내하는 상단 네비게이션을 단순화하세요.");
  }

  if (signals.hasFooter) {
    score += 3;
    strengths.push("푸터 영역이 존재합니다.");
  }

  if (signals.hasCtaHints) {
    score += 12;
    strengths.push("CTA/전환 유도 문구 신호가 감지되었습니다.");
  } else {
    score -= 8;
    weaknesses.push("명확한 CTA(문의, 신청, 시작 등)가 약합니다.");
    recommendations.push("히어로 영역에 단일 주요 CTA를 배치하세요.");
  }

  if (signals.hasForm) {
    score += 10;
    strengths.push("폼(전환 수집) 요소가 있습니다.");
  } else {
    score -= 4;
    findings.push("폼이 감지되지 않았습니다. 외부 링크 CTA일 수 있습니다.");
    recommendations.push("리드 수집용 간단 폼 또는 캘린더 예약을 추가하세요.");
  }

  if (signals.hasContact) {
    score += 8;
    strengths.push("연락/문의 경로가 노출됩니다.");
  } else {
    score -= 4;
    weaknesses.push("연락 경로가 불명확합니다.");
    recommendations.push("문의 페이지 또는 플로팅 상담 CTA를 추가하세요.");
  }

  if (signals.hasPrivacy) {
    score += 4;
    strengths.push("개인정보 처리방침 링크 신호가 있습니다.");
  } else {
    recommendations.push("신뢰 요소로 개인정보처리방침·이용약관을 푸터에 배치하세요.");
  }

  if (signals.internalLinks >= 10) {
    score += 3;
    findings.push(`내부 링크 ${signals.internalLinks}개 — 탐색 경로가 존재합니다.`);
  }

  if (!signals.https) {
    score -= 14;
    weaknesses.push("비HTTPS는 전환율과 브라우저 신뢰 경고에 악영향입니다.");
  }

  findings.push(
    "※ 로그인 장벽·문의 차단 등 퍼널 병목은 6대 D5에서만 확정 가능",
  );

  return finalizeAxis(
    "uxConversion",
    score,
    findings,
    strengths,
    weaknesses,
    recommendations,
  );
}

function scoreSocialPaid(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
): AxisScore {
  let score = 10;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const findings: string[] = [];
  const recommendations: string[] = [];

  if (signals.socialLinks.length > 0) {
    score += Math.min(18, signals.socialLinks.length * 6);
    strengths.push(`소셜 채널 링크: ${signals.socialLinks.join(", ")}`);
  } else {
    score -= 6;
    weaknesses.push("사이트에서 공식 소셜 채널 링크를 찾지 못했습니다.");
    recommendations.push("푸터/헤더에 공식 소셜 프로필 링크를 추가하세요.");
  }

  if (signals.hasOg) {
    score += 8;
    strengths.push("Open Graph로 공유 미리보기가 준비되어 있습니다.");
  } else {
    recommendations.push("OG 태그를 설정해 광고·공유 클릭률을 높이세요.");
  }

  if (signals.hasTwitterCard) {
    score += 4;
    strengths.push("Twitter/X 카드 메타가 있습니다.");
  }

  const channels = input.channels ?? [];
  if (channels.length > 0) {
    // Self-reported only — small bonus, not large inflation
    score += Math.min(8, channels.length * 2);
    findings.push(`사용 중 채널(자가 신고·미검증): ${channels.join(", ")}`);
    if (channels.includes("google_ads") || channels.includes("meta")) {
      recommendations.push(
        "유료 유입 랜딩의 메시지-키워드-CTA 일치(Message Match)를 점검하세요.",
      );
      score += 3;
    }
  } else {
    findings.push("유료/소셜 채널 미입력 — 사이트 링크 신호만 평가했습니다.");
    recommendations.push("현재 운영 중인 채널을 입력하면 진단 정밀도가 올라갑니다.");
  }

  if (signals.hasAnalyticsHints) {
    score += 10;
    strengths.push("분석/태그 매니저 관련 스크립트 신호가 있습니다.");
  } else {
    score -= 6;
    weaknesses.push("GA/GTM 등 분석 태그 신호가 약합니다.");
    recommendations.push("GA4 + 전환 이벤트를 설치해 유료 미디어 ROI를 측정하세요.");
  }

  findings.push(
    "※ 채널 활동 주기·타깃 적합도는 6대 D4 실측(30/90일)에서 판정",
  );

  return finalizeAxis(
    "socialPaid",
    score,
    findings,
    strengths,
    weaknesses,
    recommendations,
  );
}

function scoreAuthorityAi(signals: ParsedSiteSignals): AxisScore {
  // Maps loosely to D6 brand/AI signals — HTML alone is weak evidence
  let score = 10;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const findings: string[] = [];
  const recommendations: string[] = [];

  if (signals.hasJsonLd || signals.hasSchemaOrg) {
    score += 16;
    strengths.push("구조화 데이터(JSON-LD/Schema.org) 신호가 있습니다.");
  } else {
    score -= 6;
    weaknesses.push("구조화 데이터가 없습니다 — AI 검색·리치결과가 불리합니다.");
    recommendations.push(
      "Organization, WebSite, FAQ, Article 스키마를 JSON-LD로 추가하세요.",
    );
  }

  if (signals.hasAbout) {
    score += 6;
    strengths.push("브랜드/조직 소개 콘텐츠가 권위 신호로 작용합니다.");
  }

  if (signals.hasBlog) {
    score += 8;
    strengths.push("콘텐츠 허브는 E-E-A-T와 AI 인용 가능성을 높입니다.");
  } else {
    recommendations.push("전문성 증명용 가이드·케이스 스터디를 발행하세요.");
  }

  if (signals.description && signals.title) {
    score += 6;
    strengths.push("기본 메타 정보가 AI 요약 추출에 도움이 됩니다.");
  }

  if (signals.wordCount >= 500) {
    score += 6;
  } else {
    weaknesses.push("본문 정보가 적어 AI 검색 엔진이 인용할 컨텍스트가 부족합니다.");
  }

  if (signals.https) {
    score += 5;
  } else {
    score -= 10;
  }

  if (signals.hasPrivacy) {
    score += 3;
    findings.push("정책 페이지는 신뢰·규정 준수 신호입니다.");
  }

  if (signals.externalLinks > 5) {
    findings.push(`외부 링크 ${signals.externalLinks}개 — 참조 네트워크 존재.`);
    score += 3;
  }

  recommendations.push(
    "llms.txt 또는 핵심 서비스 FAQ를 공개해 AI 검색 가시성을 높이세요.",
  );
  recommendations.push(
    "저자/전문가 바이라인과 출처 명시를 콘텐츠에 추가하세요.",
  );
  findings.push(
    "※ NAP 통일·플레이스·AI 추천 노출은 6대 D6 체크리스트로 확정",
  );

  return finalizeAxis(
    "authorityAi",
    score,
    findings,
    strengths,
    weaknesses,
    recommendations,
  );
}

function finalizeAxis(
  key: DiagnosisAxisKey,
  score: number,
  findings: string[],
  strengths: string[],
  weaknesses: string[],
  recommendations: string[],
): AxisScore {
  return {
    key,
    score: clamp(score),
    findings: findings.slice(0, 6),
    strengths: strengths.slice(0, 6),
    weaknesses: weaknesses.slice(0, 6),
    recommendations: recommendations.slice(0, 6),
  };
}

function buildQuickWins(axes: AxisScore[], signals: ParsedSiteSignals): QuickWin[] {
  const wins: QuickWin[] = [];

  if (!signals.hasOg) {
    wins.push({
      title: "Open Graph 메타 태그 추가",
      description: "og:title, og:description, og:image를 설정해 공유·광고 CTR을 개선합니다.",
      impact: "high",
      effort: "low",
    });
  }
  if (!signals.hasCtaHints) {
    wins.push({
      title: "히어로 CTA 명확화",
      description: "단일 주요 행동(문의/데모/구매)을 버튼으로 고정합니다.",
      impact: "high",
      effort: "low",
    });
  }
  if (!(signals.hasJsonLd || signals.hasSchemaOrg)) {
    wins.push({
      title: "Organization + FAQ JSON-LD 삽입",
      description: "구조화 데이터로 검색 리치결과와 AI 인용 가능성을 높입니다.",
      impact: "high",
      effort: "medium",
    });
  }
  if (!signals.description) {
    wins.push({
      title: "메타 디스크립션 작성",
      description: "핵심 혜택·키워드를 담은 150자 내외 설명을 추가합니다.",
      impact: "medium",
      effort: "low",
    });
  }
  if (!signals.hasAnalyticsHints) {
    wins.push({
      title: "GA4 전환 이벤트 설치",
      description: "문의 제출, CTA 클릭 등 핵심 전환을 측정합니다.",
      impact: "high",
      effort: "medium",
    });
  }
  if (signals.socialLinks.length === 0) {
    wins.push({
      title: "공식 소셜 프로필 연결",
      description: "푸터에 Instagram/LinkedIn 등 공식 채널을 노출합니다.",
      impact: "medium",
      effort: "low",
    });
  }

  // Ensure at least 3 items from weakest axis recommendations
  if (wins.length < 3) {
    const sorted = [...axes].sort((a, b) => a.score - b.score);
    for (const axis of sorted) {
      for (const rec of axis.recommendations) {
        if (wins.length >= 5) break;
        wins.push({
          title: rec.slice(0, 40),
          description: rec,
          impact: "medium",
          effort: "medium",
        });
      }
      if (wins.length >= 3) break;
    }
  }

  return wins.slice(0, 5);
}

function buildRoadmap(
  axes: AxisScore[],
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
): RoadmapItem[] {
  const weakest = [...axes].sort((a, b) => a.score - b.score)[0];
  const industry = input.industry || "해당 산업";

  return [
    {
      phase: "30",
      title: "기반 정비 & Quick Wins",
      description:
        "메타/OG/CTA/분석 태그 등 즉시 수정 가능한 온페이지 이슈를 해결합니다. " +
        (signals.pageCountCrawled
          ? `현재 ${signals.pageCountCrawled}개 페이지 신호를 기준으로 우선순위를 잡습니다.`
          : "사이트 접근이 제한된 경우 공개 랜딩부터 재점검합니다."),
      expectedOutcome: "기본 SEO·신뢰 신호 확보, 전환 경로 명확화",
    },
    {
      phase: "60",
      title: `${weakest ? weakest.key : "핵심"} 축 강화 캠페인`,
      description: `가장 낮은 축(${weakest?.key ?? "N/A"}) 개선에 집중합니다. ${industry} 타겟 키워드 랜딩 2~3개와 콘텐츠 허브를 구축하고, 유료/오가닉 메시지를 정렬합니다.`,
      expectedOutcome: "타겟 키워드 가시성 상승, 리드 품질 개선",
    },
    {
      phase: "90",
      title: "권위·AI 검색 & 확장",
      description:
        "케이스 스터디, FAQ 스키마, 전문가 콘텐츠, 리타겟팅/CRM 자동화를 결합해 중장기 성장 엔진을 만듭니다.",
      expectedOutcome: "AI/검색 인용 가능성 확대, CAC 효율 개선, 반복 가능한 성장 루프",
    },
  ];
}

function buildExecutiveSummary(
  overall: number,
  grade: DiagnosisResult["grade"],
  axes: AxisScore[],
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
): string {
  const best = [...axes].sort((a, b) => b.score - a.score)[0];
  const worst = [...axes].sort((a, b) => a.score - b.score)[0];
  const host = signals.hostname;
  const crawlNote =
    signals.pageCountCrawled > 0
      ? `${signals.pageCountCrawled}개 페이지를 수집·분석했습니다.`
      : "대상 사이트 HTML을 충분히 수집하지 못해 공개 신호와 입력 정보 중심으로 추정 진단했습니다.";

  return (
    `${host}의 **${SURFACE_SCORE.label}**는 **${overall}점(등급 ${grade})**입니다. ` +
    `이는 6대 자가진단의 **${STRUCTURE_SCORE.label}와 다른 척도**이며, 공개 HTML 표면 신호만 반영합니다. ${crawlNote} ` +
    `상대적으로 강한 표면 영역은 **${best?.key ?? "-"}(${best?.score ?? 0}점)**, ` +
    `우선 개선이 필요한 영역은 **${worst?.key ?? "-"}(${worst?.score ?? 0}점)**입니다. ` +
    (input.keywords?.length
      ? `핵심 키워드(${input.keywords.slice(0, 5).join(", ")}) 관점에서 메시지·콘텐츠 정합성을 함께 평가했습니다. `
      : "") +
    "최종 컨설팅 기준 점수가 필요하면 6대 자가진단(실측)을 이어서 진행하세요."
  );
}

function buildKeyInsights(axes: AxisScore[], signals: ParsedSiteSignals): string[] {
  const insights: string[] = [];
  const worst = [...axes].sort((a, b) => a.score - b.score)[0];
  const best = [...axes].sort((a, b) => b.score - a.score)[0];

  if (best) insights.push(`강점 축: ${best.key} (${best.score}점) — ${best.strengths[0] ?? "상대적 우위"}`);
  if (worst)
    insights.push(
      `약점 축: ${worst.key} (${worst.score}점) — ${worst.weaknesses[0] ?? "개선 여지 큼"}`,
    );
  if (!signals.https) insights.push("보안(HTTPS) 미적용은 모든 축의 신뢰·전환을 동시에 깎습니다.");
  if (!signals.hasAnalyticsHints)
    insights.push("측정 기반이 약하면 유료 미디어와 콘텐츠 ROI를 증명하기 어렵습니다.");
  if (!(signals.hasJsonLd || signals.hasSchemaOrg))
    insights.push("구조화 데이터 부재는 기존 SEO뿐 아니라 AI 검색 가시성에도 불리합니다.");
  if (signals.hasCtaHints && signals.hasForm)
    insights.push("CTA와 폼이 모두 있어 전환 퍼널의 기본 골격은 갖추고 있습니다.");

  return insights.slice(0, 6);
}

export function createDiagnosisId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `md_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function runDiagnosis(input: DiagnosisInput): Promise<DiagnosisResult> {
  const signals = await crawlAndParse(input.url);

  // Keyword strategy first — the product goal is non-brand keyword visibility.
  // AI mode (ANTHROPIC_API_KEY) analyzes crawled content; otherwise heuristic
  // content mining. Derived keywords feed every downstream module when the
  // user did not supply keywords (previously this silently degraded to
  // brand-only evaluation).
  const keywordStrategy = await buildKeywordStrategy(
    signals,
    input,
    signals.bodyText || "",
  );
  const effInput: DiagnosisInput =
    input.keywords && input.keywords.length
      ? input
      : {
          ...input,
          keywords: [
            keywordStrategy.primaryService,
            ...keywordStrategy.tier2.slice(0, 2).map((t) => t.keyword),
          ].filter((k) => k && k !== "핵심 서비스"),
        };

  const axes: AxisScore[] = [
    scoreBrand(signals, effInput),
    scoreContentSeo(signals, effInput),
    scoreUxConversion(signals),
    scoreSocialPaid(signals, effInput),
    scoreAuthorityAi(signals),
  ];

  const { overall: overallScore, reliability } = finalizeSurfaceScore(
    axes,
    signals,
  );
  const grade = gradeFromScore(overallScore);
  const quickWins = buildQuickWins(axes, signals);
  const roadmap = buildRoadmap(axes, signals, effInput);
  const executiveSummary = buildExecutiveSummary(
    overallScore,
    grade,
    axes,
    signals,
    effInput,
  );
  const keyInsights = [
    ...buildKeyInsights(axes, signals),
    `점수 척도: ${reliability.scaleLabel} (신뢰도 ${reliability.confidence}) — ${reliability.confidenceReason}`,
    reliability.crossScaleNote,
  ].slice(0, 8);
  const highImpactPriorities = axes
    .slice()
    .sort((a, b) => a.score - b.score)
    .flatMap((a) => a.recommendations.slice(0, 2))
    .slice(0, 6);

  const id = createDiagnosisId();
  const createdAt = new Date().toISOString();
  const methodology =
    `${SURFACE_SCORE.label} 산출: 공개 HTML 경량 크롤 + 5축 휴리스틱(가중 평균) + 신뢰도 감쇠 + 상한 규칙. ` +
    `원점수 ${reliability.rawScore} → 보정 후 ${overallScore}. ` +
    `${STRUCTURE_SCORE.label}(6대 D1–D6, 정상/주의/취약 가중)와 척도가 다르며, 컨설팅 최종 기준은 구조 진단입니다. ` +
    `검색 순위·채널 활동일·전환 병목·NAP 통일은 URL만으로 확정하지 않습니다. ` +
    `SEO 실행 가이드(Before→After)는 before_after.md 실무 루틴을 일반화합니다. ` +
    `목표는 회사명 단독 SEO가 아니라, ‘회사명+메인서비스’·유관 검색어에서 공식 홈이 연결되도록 title·meta·H1·히어로·채널 신호를 정렬하는 것입니다. ` +
    `네이버 서치어드바이저 웹마스터 가이드(https://searchadvisor.naver.com/guide) 기준으로 robots·canonical·title·OG·모바일·구조화 데이터 등을 점검합니다.`;

  const seoPlaybook = buildSeoPlaybook(signals, effInput);
  const searchMeasure = buildSearchMeasureBundle({
    url: signals.url || input.url,
    title: signals.title,
    company: input.company,
    keywords: effInput.keywords,
    industry: input.industry,
    extraKeywords: keywordStrategy.tier2.slice(0, 3).map((t) => t.keyword),
  });
  const naverSeo = evaluateNaverSeo(signals, effInput);
  const localSeo = evaluateLocalSeo(signals, effInput);

  const partial: Omit<DiagnosisResult, "markdownReport"> = {
    id,
    createdAt,
    input: {
      ...input,
      url: signals.url || input.url,
    },
    siteTitle: signals.title,
    siteDescription: signals.description,
    crawledPages: signals.pages,
    overallScore,
    grade,
    reliability,
    executiveSummary,
    axes,
    keyInsights,
    quickWins,
    highImpactPriorities,
    roadmap,
    seoPlaybook,
    searchMeasure,
    naverSeo,
    localSeo,
    keywordStrategy,
    methodology,
  };

  const markdownReport = buildMarkdownReport(partial as DiagnosisResult);

  return { ...partial, markdownReport };
}
