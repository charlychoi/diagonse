/**
 * Headless auto-diagnosis for generative AI agents.
 * Input: homepage URL + company name (+ optional keywords/industry)
 * Output: structured result + full Markdown report
 */

import { runDiagnosis } from "./analyzer";
import type { DiagnosisInput, DiagnosisResult, MarketingChannel } from "./types";

export type AutoDiagnoseRequest = {
  /** Homepage URL (required) */
  url: string;
  /** Company / brand name (required for brand-search strategy) */
  company: string;
  /** Optional keywords (comma string or array). Default: derived from company + industry */
  keywords?: string[] | string;
  industry?: string;
  targetCountry?: string;
  channels?: MarketingChannel[] | string[];
  competitors?: string[] | string;
};

export type AutoDiagnoseResponse = {
  ok: true;
  version: string;
  generatedAt: string;
  input: {
    url: string;
    company: string;
    keywords?: string[];
    industry?: string;
    competitors?: string[];
  };
  scores: {
    surfaceScore: number;
    grade: string;
    brandServiceBinding: number;
    brandServiceLevel: string;
    naverGuideScore: number;
    confidence: string;
  };
  summary: string;
  axes: {
    key: string;
    score: number;
    label: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  }[];
  roadmap: DiagnosisResult["roadmap"];
  naver: {
    score: number;
    pass: number;
    warn: number;
    fail: number;
    manual: number;
    items: {
      status: string;
      category: string;
      title: string;
      detail: string;
      action: string;
    }[];
  };
  local: {
    score: number;
    ok: number;
    warn: number;
    missing: number;
    manual: number;
    nap: { name: string; phones: string[]; addresses: string[]; region: string };
    schemaTypes: string[];
    hasOrgSchema: boolean;
    hasLocalBusinessSchema: boolean;
    googleCheck: { performed: boolean; status: string; detail: string; guidance: string };
    items: { status: string; category: string; title: string; detail: string; action: string }[];
    panelPlan: { step: string; why: string }[];
    organizationJsonLd: string;
    localBusinessJsonLd: string;
    verifyLinks: { label: string; url: string; why: string }[];
  };
  brandVisibility: DiagnosisResult["seoPlaybook"]["brandVisibility"];
  beforeAfter: {
    element: string;
    before: string;
    afterA: string;
    brandSearchWhy?: string;
  }[];
  brandSearchQueries: DiagnosisResult["seoPlaybook"]["brandSearchQueries"];
  naverTopActions: string[];
  quickWins: DiagnosisResult["quickWins"];
  hero: DiagnosisResult["hero"];
  conversion: DiagnosisResult["conversion"];
  adReadiness: DiagnosisResult["adReadiness"];
  servicePages: DiagnosisResult["servicePages"];
  competitorComparison: DiagnosisResult["competitorComparison"];
  aiPrecheck: DiagnosisResult["aiPrecheck"];
  /** AI/heuristic 3-tier keyword strategy (non-brand visibility design) */
  keywordStrategy: DiagnosisResult["keywordStrategy"];
  /** Full markdown report — save as .md file */
  markdown: string;
  /** Suggested download filename */
  filename: string;
  resultId: string;
};

export type AutoDiagnoseError = {
  ok: false;
  error: string;
  code: "VALIDATION" | "DIAGNOSIS" | "INTERNAL";
};

const VERSION = "3.0.0-local";

function parseKeywords(
  raw: string[] | string | undefined,
  company: string,
  industry?: string,
): string[] | undefined {
  let list: string[] = [];
  if (Array.isArray(raw)) {
    list = raw.map((k) => String(k).trim()).filter(Boolean);
  } else if (typeof raw === "string" && raw.trim()) {
    list = raw
      .split(/[,，|]/)
      .map((k) => k.trim())
      .filter(Boolean);
  }
  if (!list.length && industry) {
    list = [industry.trim()].filter(Boolean);
  }
  // No company-name fallback: the product goal is NON-brand keyword
  // visibility. When empty, the AI/heuristic keyword strategy
  // (lib/ai-strategy) derives keywords from the crawled homepage content.
  if (!list.length) return undefined;
  // unique, max 5
  return [...new Set(list)].slice(0, 5);
}

function safeFilename(company: string, id: string): string {
  const slug = company
    .replace(/[^\w가-힣\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 40);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `마케팅_사전진단_${slug || "report"}_${day}_${id.slice(0, 8)}.md`;
}

function parseCompetitors(raw: unknown): string[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\n,，]/)
      : [];
  const out: string[] = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) continue;
    try {
      const normalized = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
      if (!/^https?:$/.test(normalized.protocol)) continue;
      out.push(normalized.toString());
    } catch {
      continue;
    }
  }
  return [...new Set(out)].slice(0, 3);
}

export function validateAutoRequest(
  body: unknown,
): { ok: true; data: AutoDiagnoseRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "JSON body required: { url, company }" };
  }
  const b = body as Record<string, unknown>;
  const url = typeof b.url === "string" ? b.url.trim() : "";
  const company =
    typeof b.company === "string"
      ? b.company.trim()
      : typeof b.companyName === "string"
        ? b.companyName.trim()
        : typeof b.brand === "string"
          ? b.brand.trim()
          : "";

  if (!url) return { ok: false, error: "url is required (homepage URL)" };
  if (!company)
    return {
      ok: false,
      error: "company is required (company or brand name). Aliases: companyName, brand",
    };

  return {
    ok: true,
    data: {
      url,
      company,
      keywords: b.keywords as string[] | string | undefined,
      industry: typeof b.industry === "string" ? b.industry.trim() : undefined,
      targetCountry:
        typeof b.targetCountry === "string" ? b.targetCountry.trim() : "대한민국",
      channels: b.channels as string[] | undefined,
      competitors: parseCompetitors(b.competitors),
    },
  };
}

export async function runAutoDiagnose(
  req: AutoDiagnoseRequest,
): Promise<AutoDiagnoseResponse> {
  const keywords = parseKeywords(req.keywords, req.company, req.industry);

  const input: DiagnosisInput = {
    url: req.url,
    company: req.company,
    keywords,
    industry: req.industry,
    targetCountry: req.targetCountry || "대한민국",
    channels: req.channels as MarketingChannel[] | undefined,
    competitors: parseCompetitors(req.competitors),
  };

  const result = await runDiagnosis(input);

  // Enrich markdown header with web diagnosis note
  const reportHeader = [
    `> **Diagonse 마케팅 사전진단** · v${VERSION}`,
    `> 입력: URL \`${req.url}\` · 회사명 **${req.company}**`,
    `> 키워드: ${(keywords || []).join(", ") || "(자동 추론 — 5.6 키워드 전략 섹션 참조)"}`,
    `> 생성: ${new Date().toISOString()} · Grok 4.5 API`,
    ``,
  ].join("\n");

  const markdown = result.markdownReport.replace(
    /^(# AI 온라인 마케팅 사전진단 보고서\n)/,
    `$1\n${reportHeader}`,
  );

  const AXIS_LABEL: Record<string, string> = {
    brand: "브랜드·포지셔닝",
    contentSeo: "콘텐츠·SEO",
    uxConversion: "UX·전환",
    socialPaid: "소셜·유료",
    authorityAi: "권위·AI검색",
  };

  return {
    ok: true,
    version: VERSION,
    generatedAt: new Date().toISOString(),
    input: {
      url: result.input.url,
      company: req.company,
      keywords,
      industry: req.industry,
      competitors: parseCompetitors(req.competitors),
    },
    scores: {
      surfaceScore: result.overallScore,
      grade: result.grade,
      brandServiceBinding: result.seoPlaybook.brandVisibility.bindingScore,
      brandServiceLevel: result.seoPlaybook.brandVisibility.level,
      naverGuideScore: result.naverSeo.score,
      confidence: result.reliability.confidence,
    },
    summary: result.executiveSummary.replace(/\*\*/g, ""),
    axes: result.axes.map((a) => ({
      key: a.key,
      score: a.score,
      label: AXIS_LABEL[a.key] || a.key,
      strengths: a.strengths,
      weaknesses: a.weaknesses,
      recommendations: a.recommendations,
    })),
    roadmap: result.roadmap,
    naver: {
      score: result.naverSeo.score,
      pass: result.naverSeo.pass,
      warn: result.naverSeo.warn,
      fail: result.naverSeo.fail,
      manual: result.naverSeo.manual,
      items: result.naverSeo.items.map((i) => ({
        status: i.status,
        category: i.category,
        title: i.title,
        detail: i.detail,
        action: i.action,
      })),
    },
    local: {
      score: result.localSeo.score,
      ok: result.localSeo.ok,
      warn: result.localSeo.warn,
      missing: result.localSeo.missing,
      manual: result.localSeo.manual,
      nap: result.localSeo.nap,
      schemaTypes: result.localSeo.schemaTypes,
      hasOrgSchema: result.localSeo.hasOrgSchema,
      hasLocalBusinessSchema: result.localSeo.hasLocalBusinessSchema,
      googleCheck: result.localSeo.googleCheck,
      items: result.localSeo.items.map((i) => ({
        status: i.status, category: i.category, title: i.title, detail: i.detail, action: i.action,
      })),
      panelPlan: result.localSeo.panelPlan,
      organizationJsonLd: result.localSeo.organizationJsonLd,
      localBusinessJsonLd: result.localSeo.localBusinessJsonLd,
      verifyLinks: result.localSeo.verifyLinks,
    },
    brandVisibility: result.seoPlaybook.brandVisibility,
    beforeAfter: result.seoPlaybook.beforeAfter.map((b) => ({
      element: b.element,
      before: b.before,
      afterA: b.afterA,
      brandSearchWhy: b.brandSearchWhy,
    })),
    brandSearchQueries: result.seoPlaybook.brandSearchQueries,
    naverTopActions: result.naverSeo.topActions,
    quickWins: result.quickWins,
    hero: result.hero,
    conversion: result.conversion,
    adReadiness: result.adReadiness,
    servicePages: result.servicePages,
    competitorComparison: result.competitorComparison,
    aiPrecheck: result.aiPrecheck,
    keywordStrategy: result.keywordStrategy,
    markdown,
    filename: safeFilename(req.company, result.id),
    resultId: result.id,
  };
}
