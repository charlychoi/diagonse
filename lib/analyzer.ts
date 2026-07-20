import type { ParsedSiteSignals } from "./crawl";
import { classifyBusiness } from "./business-classifier";
import { computeAdaptiveScores } from "./scoring/adaptive-scores";
import { validateConsistency } from "./diagnosis-consistency";
import { runPrevisitQualityPass } from "./previsit-quality";
import { buildBriefMarkdown, buildSummaryMarkdown } from "./previsit-markdown";
import { crawlAndParse } from "./crawl";
import { buildMarkdownReport } from "./report";
import { evaluateNaverSeo } from "./naver-seo-guide";
import { evaluateLocalSeo } from "./local-seo";
import { buildSearchMeasureBundle } from "./search-measure";
import { buildSeoPlaybook } from "./seo-playbook";
import { adaptKeywordStrategyForProfile, buildKeywordStrategy } from "./ai-strategy";
import { evaluateHero } from "./hero-diagnosis";
import { evaluateConversion } from "./conversion-diagnosis";
import { evaluateAdReadiness } from "./ad-readiness";
import { evaluateServicePages } from "./service-page";
import { evaluateCompetitors } from "./competitor-comparison";
import { evaluateAiPrecheck } from "./ai-precheck";
import {
  finalizeSurfaceScore,
  gradeFromScore,
} from "./score-reliability";
import {
  AXIS_META,
  type AxisScore,
  type DiagnosisAxisKey,
  type DiagnosisInput,
  type DiagnosisResult,
  type QuickWin,
  type RoadmapItem,
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
    strengths.push("검색 결과·카톡 공유 시 보이는 요약 설명(메타 디스크립션)이 있습니다.");
  } else {
    weaknesses.push("검색 결과·카톡 공유 시 보이는 요약 설명(메타 디스크립션)이 없거나 너무 짧습니다.");
    recommendations.push("검색 결과와 SNS 공유 화면에 노출될 요약 설명을 120~160자로 작성하세요.");
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
    strengths.push("카카오톡·페이스북 등에 링크를 공유할 때 보이는 미리보기 이미지(오픈그래프)가 설정되어 있습니다.");
  } else {
    recommendations.push("링크를 공유할 때 보이는 미리보기 이미지·제목(오픈그래프 태그)을 설정해 브랜드 인지도를 높이세요.");
  }

  const kws = input.keywords ?? [];
  const hay = [signals.title, signals.description, ...signals.h1s, ...signals.h2s]
    .filter(Boolean)
    .join(" ");
  const hits = keywordHits(hay, kws);
  if (kws.length > 0) {
    if (hits.length > 0) {
      score += Math.min(10, hits.length * 3);
      strengths.push(`핵심 키워드가 홈페이지 문구에 노출됨: ${hits.join(", ")}`);
    } else {
      score -= 4;
      weaknesses.push("핵심 키워드가 홈페이지 문구에 거의 나타나지 않습니다.");
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
    strengths.push("같은 페이지가 여러 주소로 중복 인식되지 않도록 정리하는 대표 주소 표시(canonical 태그)가 되어 있습니다.");
  } else {
    recommendations.push("검색엔진이 중복 페이지로 오인하지 않도록 대표 주소 표시(canonical 태그)를 추가하세요.");
  }

  if (signals.hasViewport) score += 3;
  if (signals.lang) {
    score += 3;
    strengths.push(`홈페이지 사용 언어가 ${signals.lang === "ko" ? "한국어" : signals.lang}로 지정되어 있습니다.`);
  } else {
    recommendations.push("홈페이지 소스에 사용 언어(한국어)를 명시하는 설정을 추가하세요.");
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
    strengths.push("검색엔진에 전체 페이지 목록을 알려주는 사이트맵이 있습니다.");
  } else {
    recommendations.push("전체 페이지 목록을 검색엔진에 알려주는 사이트맵을 만들어 구글 서치콘솔에 등록하세요.");
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
    "※ 네이버·구글 검색 1페이지 노출 여부는 홈페이지 화면만 보고는 알 수 없고, 실제 검색으로 직접 확인해야 합니다.",
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
    strengths.push("휴대폰 화면 크기에 맞춰 자동으로 조절되는 설정(모바일 반응형)이 되어 있습니다.");
  } else {
    score -= 8;
    weaknesses.push("휴대폰 화면 크기에 맞춰 자동으로 조절되는 설정(모바일 반응형)이 없습니다.");
    recommendations.push("휴대폰에서도 화면이 자동으로 맞춰지도록 반응형 설정을 추가하세요.");
  }

  if (signals.hasNav) {
    score += 6;
    strengths.push("상단 메뉴(내비게이션) 구조가 확인됩니다.");
  } else {
    weaknesses.push("상단 메뉴(내비게이션) 구조가 명확하지 않습니다.");
    recommendations.push("방문자가 핵심 페이지를 쉽게 찾도록 상단 메뉴를 단순화하세요.");
  }

  if (signals.hasFooter) {
    score += 3;
    strengths.push("푸터 영역이 존재합니다.");
  }

  const conversion = signals.conversion;
  const actualPaths = conversion
    ? conversion.telLinks.length + conversion.mailtoLinks.length + conversion.kakaoLinks.length + conversion.naverTalkLinks.length + conversion.bookingLinks.length + conversion.contactPageUrls.length
    : 0;
  if (signals.hasCtaHints && actualPaths > 0) {
    score += 14;
    strengths.push(`CTA와 실제 전환 링크 ${actualPaths}개가 연결되어 있습니다.`);
  } else if (signals.hasCtaHints) {
    score += 3;
    weaknesses.push("CTA 문구는 있으나 실제 문의·예약·전화 연결이 약합니다.");
    recommendations.push("CTA를 실제 문의 페이지, tel:, 예약 또는 상담 링크에 연결하세요.");
  } else {
    score -= 8;
    weaknesses.push("명확한 CTA(문의, 신청, 시작 등)가 약합니다.");
    recommendations.push("히어로 영역에 단일 주요 CTA를 배치하세요.");
  }

  if (signals.hasForm || (conversion?.bookingLinks.length || 0) > 0 || (conversion?.kakaoLinks.length || 0) > 0 || (conversion?.naverTalkLinks.length || 0) > 0) {
    score += 10;
    strengths.push("폼 또는 외부 예약·상담 경로가 있습니다.");
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

  if (signals.phones.length && !(conversion?.telLinks.length || 0)) {
    weaknesses.push("전화번호는 보이나 모바일 클릭 전화(tel:) 링크가 없습니다.");
    recommendations.push("모바일 방문자가 바로 통화하도록 전화번호에 tel: 링크를 적용하세요.");
    score -= 4;
  }

  if ((conversion?.kakaoLinks.length || 0) + (conversion?.naverTalkLinks.length || 0) > 0) {
    strengths.push("카카오톡 또는 네이버 상담 연결이 있어 모바일 전환 장벽이 낮습니다.");
    score += 5;
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
    "※ 로그인 요구·문의 막힘 같은 실제 상담 과정의 병목은 직접 신청해봐야 정확히 알 수 있습니다.",
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
    strengths.push("링크 공유 시 보이는 미리보기(오픈그래프)가 준비되어 있습니다.");
  } else {
    recommendations.push("링크 공유·광고 클릭률을 높이도록 공유 미리보기(오픈그래프 태그)를 설정하세요.");
  }

  if (signals.hasTwitterCard) {
    score += 4;
    strengths.push("X(트위터)에 공유할 때의 미리보기 설정도 되어 있습니다.");
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
    strengths.push("방문자 행동을 기록하는 분석 도구(예: 구글 애널리틱스)가 설치되어 있습니다.");
  } else {
    score -= 6;
    weaknesses.push("방문자 행동을 기록하는 분석 도구(예: 구글 애널리틱스)가 보이지 않습니다.");
    recommendations.push("구글 애널리틱스(GA4)를 설치하고 상담·문의 전환을 추적해, 광고비 대비 효과를 숫자로 확인하세요.");
  }

  findings.push(
    "※ 실제로 얼마나 자주 채널을 운영하고 타겟에 맞는지는 최근 30~90일 활동을 직접 확인해야 정확히 알 수 있습니다.",
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
    strengths.push("검색엔진과 AI가 우리 정보를 자동으로 이해하도록 돕는 코드(구조화 데이터)가 있습니다.");
  } else {
    score -= 6;
    weaknesses.push("검색엔진과 AI가 우리 정보를 자동으로 이해하도록 돕는 코드(구조화 데이터)가 없어, 검색 결과 강조 노출이나 AI 답변 인용에 불리합니다.");
    recommendations.push(
      "회사 정보·서비스·자주 묻는 질문을 검색엔진이 읽을 수 있는 형식(구조화 데이터, 예: JSON-LD)으로 추가하세요.",
    );
  }

  if (signals.hasAbout) {
    score += 6;
    strengths.push("회사·브랜드 소개 콘텐츠가 있어 신뢰도를 높이는 데 도움이 됩니다.");
  }

  if (signals.hasBlog) {
    score += 8;
    strengths.push("꾸준히 글을 올리는 콘텐츠 공간(블로그)이 있어 전문성을 보여주고 AI가 인용할 가능성도 높입니다.");
  } else {
    recommendations.push("전문성을 보여줄 수 있는 가이드·사례 글을 꾸준히 발행하세요.");
  }

  if (signals.description && signals.title) {
    score += 6;
    strengths.push("제목·요약 설명이 잘 갖춰져 있어 챗GPT 같은 AI가 요약할 때 도움이 됩니다.");
  }

  if (signals.wordCount >= 500) {
    score += 6;
  } else {
    weaknesses.push("본문 설명이 적어 AI가 답변할 때 참고할 내용이 부족합니다.");
  }

  if (signals.https) {
    score += 5;
  } else {
    score -= 10;
  }

  if (signals.hasPrivacy) {
    score += 3;
    findings.push("개인정보처리방침 페이지가 있어 신뢰·법규 준수 신호로 작용합니다.");
  }

  if (signals.externalLinks > 5) {
    findings.push(`다른 사이트로 연결되는 링크가 ${signals.externalLinks}개 있어 참조 관계가 존재합니다.`);
    score += 3;
  }

  recommendations.push(
    "핵심 서비스 FAQ를 공개하거나 llms.txt(AI가 사이트를 이해하도록 돕는 안내 파일)를 만들어 AI 검색 노출을 높이세요.",
  );
  recommendations.push(
    "저자/전문가 바이라인과 출처 명시를 콘텐츠에 추가하세요.",
  );
  findings.push(
    "※ 상호·주소·전화번호가 여러 곳에서 통일되게 쓰이는지, 지도·AI 추천에 노출되는지는 별도 체크리스트로 확인이 필요합니다.",
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
  keywordsAreUserProvided: boolean,
): string {
  const best = [...axes].sort((a, b) => b.score - a.score)[0];
  const worst = [...axes].sort((a, b) => a.score - b.score)[0];
  const bestLabel = best ? AXIS_META[best.key].labelKo : "-";
  const worstLabel = worst ? AXIS_META[worst.key].labelKo : "-";
  const host = signals.hostname;
  const crawlNote =
    signals.pageCountCrawled > 0
      ? `홈페이지 ${signals.pageCountCrawled}개 페이지의 콘텐츠와 구조를 AI가 분석했습니다.`
      : "홈페이지 내용을 충분히 가져오지 못해, 입력하신 정보 위주로 AI가 추정해서 진단했습니다.";

  return (
    `${host} 홈페이지에 실제로 게시된 콘텐츠·구조·메시지를 AI가 분석한 결과는 **${overall}점(등급 ${grade})**입니다. ` +
    `다만 실시간 검색 순위나 실제 상담 전환율 자체를 측정한 것은 아니며, 그 부분은 직접 확인이 별도로 필요합니다. ${crawlNote} ` +
    `5가지 항목 중 **${bestLabel}**이(가) 상대적으로 잘 되어 있고(${best?.score ?? 0}점), ` +
    `**${worstLabel}**은(는) 가장 먼저 손봐야 할 부분입니다(${worst?.score ?? 0}점). ` +
    (input.keywords?.length
      ? keywordsAreUserProvided
        ? `입력하신 핵심 키워드(${input.keywords.slice(0, 5).join(", ")})가 홈페이지 문구와 잘 맞는지도 함께 살펴봤습니다. `
        : `AI가 홈페이지 내용을 분석해 찾아낸 핵심 키워드(${input.keywords.slice(0, 5).join(", ")})를 기준으로 문구가 잘 맞는지도 함께 살펴봤습니다. `
      : "") +
    "아래 실행 계획부터 순서대로 확인해 우선순위가 높은 항목부터 개선해 보세요."
  );
}

function buildKeyInsights(axes: AxisScore[], signals: ParsedSiteSignals): string[] {
  const insights: string[] = [];
  const worst = [...axes].sort((a, b) => a.score - b.score)[0];
  const best = [...axes].sort((a, b) => b.score - a.score)[0];

  if (best) insights.push(`강점: ${AXIS_META[best.key].labelKo} (${best.score}점) — ${best.strengths[0] ?? "상대적으로 잘 되어 있는 부분"}`);
  if (worst)
    insights.push(
      `약점: ${AXIS_META[worst.key].labelKo} (${worst.score}점) — ${worst.weaknesses[0] ?? "가장 먼저 개선이 필요한 부분"}`,
    );
  if (!signals.https) insights.push("주소창에 자물쇠 표시(HTTPS 보안 연결)가 없으면 방문자 신뢰도와 상담 전환이 함께 떨어집니다.");
  if (!signals.hasAnalyticsHints)
    insights.push("방문자 행동을 기록하는 분석 도구(예: 구글 애널리틱스)가 없으면 광고·콘텐츠 효과를 숫자로 증명하기 어렵습니다.");
  if (!(signals.hasJsonLd || signals.hasSchemaOrg))
    insights.push("검색엔진과 AI가 우리 정보를 자동으로 읽도록 돕는 코드(구조화 데이터)가 없으면 검색 노출과 AI 답변 인용에 불리합니다.");
  if (signals.hasCtaHints && signals.hasForm)
    insights.push("행동 유도 문구(CTA)와 문의 폼이 모두 있어 상담·문의로 이어지는 기본 골격은 갖추고 있습니다.");

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

  // v4(§9.1 MUST 3): 비즈니스 모델 분류는 모든 유형별 채점보다 먼저 실행한다.
  const businessProfile = await classifyBusiness(signals, input, {
    override: input.businessProfileOverride,
  });
  const conversionCapExempt =
    businessProfile.primaryMarketMotion !== "b2c_service" &&
    businessProfile.primaryMarketMotion !== "unknown";

  // Keyword strategy first — the product goal is non-brand keyword visibility.
  // Optional Grok API keyword analysis; otherwise heuristic
  // content mining. Derived keywords feed every downstream module when the
  // user did not supply keywords (previously this silently degraded to
  // brand-only evaluation).
  const keywordStrategy = adaptKeywordStrategyForProfile(
    await buildKeywordStrategy(signals, input, signals.bodyText || ""),
    businessProfile,
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
    { conversionCapExempt },
  );
  const grade = gradeFromScore(overallScore);
  const quickWins = buildQuickWins(axes, signals);
  const roadmap = buildRoadmap(axes, signals, effInput);
  const keywordsAreUserProvided = Boolean(input.keywords && input.keywords.length);
  const executiveSummary = buildExecutiveSummary(
    overallScore,
    grade,
    axes,
    signals,
    effInput,
    keywordsAreUserProvided,
  );
  const keyInsights = buildKeyInsights(axes, signals).slice(0, 6);
  const highImpactPriorities = axes
    .slice()
    .sort((a, b) => a.score - b.score)
    .flatMap((a) => a.recommendations.slice(0, 2))
    .slice(0, 6);

  const id = createDiagnosisId();
  const createdAt = new Date().toISOString();
  const methodology =
    `이 점수는 홈페이지 화면에 공개된 정보만 가져와(직접 방문하거나 로그인하지 않고), 5가지 항목을 각각 채점한 뒤 평균을 낸 것입니다(원점수 ${reliability.rawScore}점 → 신뢰도 보정 후 ${overallScore}점). ` +
    `6대 자가진단(정상/주의/취약으로 직접 답하는 정밀 진단)과는 채점 방식이 달라서 점수를 그대로 비교할 수 없으며, 실제 컨설팅 기준은 6대 자가진단입니다. ` +
    `실제 검색 순위, SNS 채널 운영 빈도, 상담 신청 시 막히는 지점, 상호·주소·전화번호가 여러 곳에서 통일되어 있는지는 홈페이지 화면만으로는 확정할 수 없습니다. ` +
    `이 진단의 목표는 회사 이름만으로 검색될 때가 아니라, '회사명+핵심 서비스' 같은 실제 고객이 검색할 만한 문구로 검색했을 때 공식 홈페이지가 노출되도록, 제목·요약 설명·헤드라인·채널 정보를 정리하는 것입니다. ` +
    `네이버 서치어드바이저 웹마스터 가이드(https://searchadvisor.naver.com/guide) 기준으로 검색로봇 허용 설정, 대표 주소 표시(canonical), 제목·공유 미리보기(OG), 모바일 대응, 구조화 데이터 등을 점검합니다.`;

  const seoPlaybook = buildSeoPlaybook(signals, effInput, businessProfile);
  const searchMeasure = buildSearchMeasureBundle({
    url: signals.url || input.url,
    title: signals.title,
    company: input.company,
    keywords: effInput.keywords,
    industry: input.industry,
    extraKeywords: keywordStrategy.tier2.slice(0, 3).map((t) => t.keyword),
  });
  const naverSeo = evaluateNaverSeo(signals, effInput);
  const hero = evaluateHero(signals, effInput);
  const conversion = evaluateConversion(signals, businessProfile);
  const adReadiness = evaluateAdReadiness(signals, hero, conversion);
  const servicePages = evaluateServicePages(signals);
  const aiPrecheck = await evaluateAiPrecheck(signals, effInput, {
    hero,
    conversion,
    adReadiness,
    servicePages,
  });
  const hasManualCompetitors = Boolean(effInput.competitors?.length);
  const aiCompetitors = aiPrecheck.competitorCandidates.map((candidate) => candidate.url).slice(0, 3);
  const competitorInput = hasManualCompetitors || !aiCompetitors.length
    ? effInput
    : { ...effInput, competitors: aiCompetitors };
  const competitorSource = hasManualCompetitors ? "user" : aiCompetitors.length ? "ai" : "none";
  const competitorNameHints = aiPrecheck.competitorCandidates.map((c) => ({ url: c.url, name: c.name }));
  const [localSeo, competitorComparison] = await Promise.all([
    evaluateLocalSeo(signals, effInput, aiPrecheck.googlePresence),
    evaluateCompetitors(signals, competitorInput, competitorSource, competitorNameHints),
  ]);

  const adaptiveScores = computeAdaptiveScores(signals, businessProfile);
  const consistencyWarnings = validateConsistency(businessProfile, adaptiveScores, {
    conversionChecks: conversion.checks,
    executiveSummary,
  });

  const prePartial = {
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
    hero,
    conversion,
    adReadiness,
    servicePages,
    competitorComparison,
    aiPrecheck,
    businessProfile,
    adaptiveScores,
    consistencyWarnings,
    keywordStrategy,
    methodology,
  };

  // v4.2: 상세 보고서(markdownReport)를 먼저 완성한 뒤, 그 원문을 근거로
  // AI 품질 패스(사전진단 요약·방문 전 브리핑·자기검증)를 실행한다.
  // — "요약"이 상세 보고서와 다른 이야기를 하는 핀트 어긋남을 막기 위한 순서.
  const withPlaceholders = {
    ...prePartial,
    previsitQuality: undefined as never,
    briefMarkdown: "",
    summaryMarkdown: "",
  };
  const markdownReport = buildMarkdownReport(withPlaceholders as Omit<DiagnosisResult, "markdownReport">);

  const previsitQuality = await runPrevisitQualityPass(markdownReport, prePartial);
  const partial: Omit<DiagnosisResult, "markdownReport"> = {
    ...prePartial,
    previsitQuality,
    briefMarkdown: buildBriefMarkdown({ ...prePartial, previsitQuality, briefMarkdown: "", summaryMarkdown: "" }, previsitQuality),
    summaryMarkdown: buildSummaryMarkdown({ ...prePartial, previsitQuality, briefMarkdown: "", summaryMarkdown: "" }, previsitQuality),
  };

  return { ...partial, markdownReport };
}
