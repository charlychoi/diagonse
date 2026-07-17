/** MarkDiag core domain types (PRD Phase 1 MVP) */

import type { NaverSeoReport } from "./naver-seo-guide";
import type { ScoreReliability } from "./score-reliability";
import type { SearchMeasureBundle } from "./search-measure";
import type { SeoPlaybook } from "./seo-playbook";

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
    description: "title·H1·About 등 공개 메시지 정렬 (HTML 표면)",
    notMeasured: "브랜드 검색 시 실제 노출·지도 패널·NAP 통일",
    measureHow: "검색 실측(브랜드 쿼리) + 6대 D6",
  },
  contentSeo: {
    label: "Content & SEO",
    labelKo: "콘텐츠·SEO",
    description: "메타·본문 분량·H2 등 온페이지 마크업 (HTML 표면)",
    notMeasured: "네이버/구글 순위·색인율·키워드 1페이지 실노출",
    measureHow: "검색 실측 링크 확인 + 6대 D1",
  },
  uxConversion: {
    label: "Website UX & Conversion",
    labelKo: "UX·전환",
    description: "CTA 문구·폼 태그·뷰포트 존재 여부 (HTML 표면)",
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
    description: "스키마·HTTPS·정책 페이지 등 기술 신호 (HTML 표면)",
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

export type DiagnosisInput = {
  url: string;
  /** Company / brand name (for AI auto-diagnose — preferred over hostname guess) */
  company?: string;
  keywords?: string[];
  industry?: string;
  targetCountry?: string;
  channels?: MarketingChannel[];
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
  /**
   * Pre-built search verification tasks (links).
   * status fields start as 미확인; client fills after human SERP check.
   */
  searchMeasure: SearchMeasureBundle;
  /** Naver Search Advisor guide compliance checklist */
  naverSeo: NaverSeoReport;
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
