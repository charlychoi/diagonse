/** MarkDiag core domain types (PRD Phase 1 MVP) */

import type { NaverSeoReport } from "./naver-seo-guide";
import type { LocalSeoReport } from "./local-seo";
import type { ScoreReliability } from "./score-reliability";
import type { SearchMeasureBundle } from "./search-measure";
import type { SeoPlaybook } from "./seo-playbook";
import type { KeywordStrategy } from "./ai-strategy";
import type { AdaptiveDiagnosisScores, BusinessProfile, BusinessProfileOverride } from "./business-profile-types";
import type { PrevisitQualityReport } from "./previsit-quality";

export type DiagnosisAxisKey =
  | "brand"
  | "contentSeo"
  | "uxConversion"
  | "socialPaid"
  | "authorityAi";

export const AXIS_META: Record<
  DiagnosisAxisKey,
  {
    label: string;
    labelKo: string;
    description: string;
    /** What this score is NOT measuring */
    notMeasured: string;
    /** How to get real measurement */
    measureHow: string;
  }
> = {
  brand: {
    label: "Brand & Positioning",
    labelKo: "브랜드·포지셔닝",
    description: "제목·H1·회사소개 등 홈페이지에 게시된 메시지 정렬 상태를 AI가 분석",
    notMeasured: "브랜드 검색 시 실제 노출·지도 패널·NAP 통일",
    measureHow: "검색 실측(브랜드 쿼리) + 6대 D6",
  },
  contentSeo: {
    label: "Content & SEO",
    labelKo: "콘텐츠·SEO",
    description: "요약 설명·본문 분량·소제목 구성 등 페이지 콘텐츠를 AI가 분석",
    notMeasured: "네이버/구글 순위·색인율·키워드 1페이지 실노출",
    measureHow: "검색 실측 링크 확인 + 6대 D1",
  },
  uxConversion: {
    label: "Website UX & Conversion",
    labelKo: "UX·전환",
    description: "행동 유도 문구·문의 폼·모바일 대응 여부를 AI가 분석",
    notMeasured: "로그인 장벽·문의 이탈·실제 전환율(퍼널 걷기)",
    measureHow: "6대 D5에서 손님 여정 통과/차단 기록",
  },
  socialPaid: {
    label: "Social & Paid Media",
    labelKo: "소셜·유료 미디어",
    description: "소셜 링크 유무·채널 자가 입력 (선언 신호)",
    notMeasured: "최근 30·90일 포스팅·광고 집행·채널 적합 운영",
    measureHow: "6대 D4 채널 활동·적합도 입력",
  },
  authorityAi: {
    label: "Authority & AI Search",
    labelKo: "권위·AI 검색",
    description: "구조화 데이터·보안 연결·정책 페이지 등 신뢰 신호를 AI가 분석",
    notMeasured: "AI 추천 여부·리뷰 수·플레이스 실측",
    measureHow: "6대 D6 AI/플레이스 문항 + 검색 실측",
  },
};

export type MarketingChannel =
  | "google_ads"
  | "meta"
  | "instagram"
  | "naver"
  | "youtube"
  | "linkedin"
  | "email"
  | "other";

export type DiagnosticStatus = "pass" | "warn" | "fail" | "manual" | "not_applicable" | "not_observed";
export type DiagnosticCheck = {
  id: string;
  title: string;
  status: DiagnosticStatus;
  detail: string;
  action: string;
};

export type HeroDiagnosisReport = {
  score: number;
  headline: string | null;
  subcopy: string | null;
  ctas: string[];
  trustSignals: string[];
  checks: DiagnosticCheck[];
  summary: string;
  topActions: string[];
};

export type ConversionDiagnosisReport = {
  score: number;
  checks: DiagnosticCheck[];
  paths: {
    ctaTexts: string[];
    tel: number;
    email: number;
    kakao: number;
    naver: number;
    booking: number;
    contactPages: number;
    forms: number;
  };
  summary: string;
  topActions: string[];
};

export type AdReadinessReport = {
  score: number;
  level: "양호" | "주의" | "취약";
  summary: string;
  checks: DiagnosticCheck[];
  topActions: string[];
};

export type ServicePageDiagnosis = {
  pages: {
    url: string;
    title: string | null;
    h1: string | null;
    score: number;
    checks: DiagnosticCheck[];
  }[];
  summary: string;
  topActions: string[];
};

export type CompetitorComparisonReport = {
  enabled: boolean;
  source: "user" | "ai" | "none";
  competitors: {
    url: string;
    /** Company/brand name — from AI web-search candidate when source="ai", else derived from crawled title/hostname */
    name: string | null;
    title: string | null;
    h1: string | null;
    hasDescription: boolean;
    hasCta: boolean;
    hasForm: boolean;
    hasBlog: boolean;
    hasJsonLd: boolean;
    hasContact: boolean;
    wordCount: number;
    strengths: string[];
    error?: string;
  }[];
  comparison: { item: string; ours: string; competitors: string; interpretation: string }[];
  summary: string;
  topActions: string[];
};

export type AiPrecheckReport = {
  enabled: boolean;
  provider: "anthropic" | "openai" | "xai" | "gemini" | "none";
  model: string | null;
  usedWebSearch: boolean;
  summary: string;
  priorities: { title: string; reason: string; action: string; impact: "high" | "medium" | "low" }[];
  messaging: { headline: string; subcopy: string; primaryCta: string } | null;
  competitorCandidates: { name: string; url: string; reason: string; confidence: "high" | "medium" | "low" }[];
  googlePresence: { status: "present" | "absent" | "unclear"; detail: string; guidance: string } | null;
  citations: string[];
  error?: string;
};

export type DiagnosisInput = {
  url: string;
  /** Company / brand name (for AI auto-diagnose — preferred over hostname guess) */
  company?: string;
  keywords?: string[];
  industry?: string;
  targetCountry?: string;
  channels?: MarketingChannel[];
  competitors?: string[];
  /** v4: 자동 분류가 틀렸을 때 사용자 정정 (§17.1) */
  businessProfileOverride?: BusinessProfileOverride;
};

export type AxisScore = {
  key: DiagnosisAxisKey;
  score: number;
  findings: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

export type QuickWin = {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
};

export type RoadmapItem = {
  phase: "30" | "60" | "90";
  title: string;
  description: string;
  expectedOutcome: string;
};

export type DiagnosisResult = {
  id: string;
  createdAt: string;
  input: DiagnosisInput;
  siteTitle: string | null;
  siteDescription: string | null;
  crawledPages: string[];
  overallScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  /** Reliability / scale metadata — required for trustworthy comparison with D1–D6 */
  reliability: ScoreReliability;
  executiveSummary: string;
  axes: AxisScore[];
  keyInsights: string[];
  quickWins: QuickWin[];
  highImpactPriorities: string[];
  roadmap: RoadmapItem[];
  /** Concrete SEO Before→After playbook (before_after.md routine) */
  seoPlaybook: SeoPlaybook;
  /** AI/heuristic keyword strategy — non-brand keyword visibility design */
  keywordStrategy: KeywordStrategy;
  /**
   * Pre-built search verification tasks (links).
   * status fields start as 미확인; client fills after human SERP check.
   */
  searchMeasure: SearchMeasureBundle;
  /** Naver Search Advisor guide compliance checklist */
  naverSeo: NaverSeoReport;
  /** Google Business Profile / local SEO strategy */
  localSeo: LocalSeoReport;
  hero: HeroDiagnosisReport;
  conversion: ConversionDiagnosisReport;
  adReadiness: AdReadinessReport;
  servicePages: ServicePageDiagnosis;
  competitorComparison: CompetitorComparisonReport;
  aiPrecheck: AiPrecheckReport;
  /** v4: 채점 이전에 판별된 비즈니스 프로필 (§9.1 MUST 3) */
  businessProfile: BusinessProfile;
  /** v4: 공통+여정별 적응형 점수 (N/A 분모 제외) */
  adaptiveScores: AdaptiveDiagnosisScores;
  /** v4: 일관성 검증 경고 (§20) */
  consistencyWarnings: { code: string; message: string }[];
  /** v4.1: AI 품질 패스 — 쉬운 요약·방문 전 브리핑·자기검증 */
  previsitQuality: PrevisitQualityReport;
  /** v4.1: 방문 전 브리핑 팩 (Markdown, PDF는 print 경로) */
  briefMarkdown: string;
  /** v4.2: 사전진단 상세 보고서(markdownReport)를 쉬운 말로 요약한 Markdown */
  summaryMarkdown: string;
  methodology: string;
  markdownReport: string;
};

export type StoredDiagnosisSummary = {
  id: string;
  createdAt: string;
  url: string;
  overallScore: number;
  grade: DiagnosisResult["grade"];
  siteTitle: string | null;
};
