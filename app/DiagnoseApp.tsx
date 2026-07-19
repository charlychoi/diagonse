"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  buildStandaloneHtml,
  downloadBlob,
  openPrintPdf,
  reportBaseName,
} from "../lib/export-report";

type AxisScore = {
  key: string;
  score: number;
  label: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};
type RoadmapItem = { phase: "30" | "60" | "90"; title: string; description: string; expectedOutcome: string };
type NaverItem = { status: string; category: string; title: string; detail: string; action: string };
type BeforeAfter = { element: string; before: string; afterA: string; brandSearchWhy?: string };
type QuickWin = { title: string; description: string; impact: string; effort: string };
type LocalItem = { status: string; category: string; title: string; detail: string; action: string };
type DiagnosticCheck = { id: string; title: string; status: string; detail: string; action: string };
type HeroReport = { score: number; headline: string | null; subcopy: string | null; ctas: string[]; trustSignals: string[]; checks: DiagnosticCheck[]; summary: string; topActions: string[] };
type ConversionReport = { score: number; checks: DiagnosticCheck[]; paths: { ctaTexts: string[]; tel: number; email: number; kakao: number; naver: number; booking: number; contactPages: number; forms: number }; summary: string; topActions: string[] };
type AdReadiness = { score: number; level: string; summary: string; checks: DiagnosticCheck[]; topActions: string[] };
type ServicePages = { pages: { url: string; title: string | null; h1: string | null; score: number; checks: DiagnosticCheck[] }[]; summary: string; topActions: string[] };
type CompetitorReport = { enabled: boolean; source: "user" | "ai" | "none"; competitors: { url: string; name: string | null; title: string | null; error?: string; strengths: string[] }[]; comparison: { item: string; ours: string; competitors: string; interpretation: string }[]; summary: string; topActions: string[] };
type AiPrecheck = {
  enabled: boolean;
  provider: "anthropic" | "openai" | "xai" | "gemini" | "none";
  model: string | null;
  usedWebSearch: boolean;
  summary: string;
  priorities: { title: string; reason: string; action: string; impact: "high" | "medium" | "low" }[];
  messaging: { headline: string; subcopy: string; primaryCta: string } | null;
  competitorCandidates: { name: string; url: string; reason: string; confidence: string }[];
  citations: string[];
  error?: string;
};
type LocalSeo = {
  score: number;
  ok: number; warn: number; missing: number; manual: number;
  nap: { name: string; phones: string[]; addresses: string[]; region: string };
  schemaTypes: string[];
  hasOrgSchema: boolean;
  hasLocalBusinessSchema: boolean;
  googleCheck: { performed: boolean; status: string; detail: string; guidance: string };
  items: LocalItem[];
  panelPlan: { step: string; why: string }[];
  organizationJsonLd: string;
  localBusinessJsonLd: string;
  verifyLinks: { label: string; url: string; why: string }[];
};
type KeywordTier = { keyword: string; intent: string };
type KeywordStrategy = {
  source: "ai" | "heuristic";
  model?: string;
  mainBusiness: string;
  primaryService: string;
  regions: string[];
  tier1: KeywordTier[];
  tier2: KeywordTier[];
  tier3: KeywordTier[];
  titleAfter: string;
  metaAfter: string;
  h1After: string;
  notes: string[];
};

type DiagnoseOk = {
  ok: true;
  summary: string;
  filename: string;
  markdown: string;
  scores: {
    surfaceScore: number;
    grade: string;
    brandServiceBinding: number;
    brandServiceLevel: string;
    naverGuideScore: number;
    confidence: string;
  };
  axes?: AxisScore[];
  keywordStrategy?: KeywordStrategy;
  roadmap?: RoadmapItem[];
  naver?: { score: number; pass: number; warn: number; fail: number; manual: number; items: NaverItem[] };
  beforeAfter?: BeforeAfter[];
  quickWins?: QuickWin[];
  local?: LocalSeo;
  hero?: HeroReport;
  conversion?: ConversionReport;
  adReadiness?: AdReadiness;
  servicePages?: ServicePages;
  competitorComparison?: CompetitorReport;
  aiPrecheck?: AiPrecheck;
  businessProfile?: {
    primaryMarketMotion: string;
    secondaryMarketMotions: string[];
    isHybrid: boolean;
    confidence: number;
    confidenceLabel: "high" | "medium" | "low";
    needsConfirmation: boolean;
    source: string;
    evidence: { claim: string; evidenceText: string; strength: string }[];
    audiences: { label: string; roles: string[] }[];
    journeys: { id: string; label: string; priority: string; objective: string }[];
  };
  adaptiveScores?: {
    coreReadiness: { score: number | null; applicableCount: number; naCount: number };
    journeyScores: { journeyId: string; journeyLabel: string; priority: string; score: number | null; applicableCount: number; naCount: number; narrative: string }[];
    overallScore: number | null;
    grade: string | null;
    provisional: boolean;
  };
  briefMarkdown?: string;
  easyMarkdown?: string;
  input: { url: string; company: string; keywords?: string[]; industry?: string; competitors?: string[] };
};

const MOTION_KO: Record<string, string> = {
  b2c_service: "개인 대상 서비스(B2C)", b2b_service: "기업 대상 서비스(B2B)", b2g: "공공기관 대상(B2G)",
  b2b2c: "기업 구매·개인 사용(B2B2C)", b2g2c: "공공 구매·시민 수혜(B2G2C)", d2c_ecommerce: "자체 상품 판매(D2C)",
  retail_ecommerce: "온라인 판매(쇼핑몰)", saas: "소프트웨어 구독(SaaS)", marketplace: "플랫폼·마켓플레이스",
  membership_community: "회원·커뮤니티", media_content: "콘텐츠·미디어", nonprofit_public_interest: "비영리·공익",
  hybrid: "복합 모델", unknown: "분류 보류",
};

function scoreColor(n: number): string {
  if (n < 40) return "#e11d48";
  if (n < 70) return "#f59e0b";
  return "#16a34a";
}
function tierClass(t: 1 | 2 | 3): string {
  return `kw-tier kw-tier-${t}`;
}
const NAVER_BADGE: Record<string, { cls: string; label: string }> = {
  pass: { cls: "nb-pass", label: "통과" },
  warn: { cls: "nb-warn", label: "주의" },
  fail: { cls: "nb-fail", label: "미흡" },
  manual: { cls: "nb-manual", label: "수동확인" },
};
function impactBadge(v: string): string {
  if (v === "high") return "높음";
  if (v === "medium") return "중간";
  return "낮음";
}
const LOCAL_BADGE: Record<string, { cls: string; label: string }> = {
  ok: { cls: "nb-pass", label: "양호" },
  warn: { cls: "nb-warn", label: "보강" },
  missing: { cls: "nb-fail", label: "미흡" },
  manual: { cls: "nb-manual", label: "수동확인" },
};
const DIAG_BADGE: Record<string, { cls: string; label: string }> = {
  pass: { cls: "nb-pass", label: "양호" },
  warn: { cls: "nb-warn", label: "주의" },
  fail: { cls: "nb-fail", label: "취약" },
  manual: { cls: "nb-manual", label: "확인 필요" },
};

type DiagnoseErr = { ok: false; error: string };

export function DiagnoseApp() {
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [keywords, setKeywords] = useState("");
  const [industry, setIndustry] = useState("");
  const [notes, setNotes] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [showOptional, setShowOptional] = useState(false);
  const [tab, setTab] = useState<"summary" | "search" | "biz" | "action" | "raw">("summary");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnoseOk | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const baseName = useMemo(() => {
    if (!result) return "마케팅_사전진단";
    return reportBaseName(result.filename, result.input.company);
  }, [result]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExportMsg(null);
    setResult(null);

    const cleanUrl = url.trim();
    const cleanCompany = company.trim();
    if (!cleanUrl) {
      setError("회사 홈페이지 URL을 입력해 주세요.");
      return;
    }
    if (!cleanCompany) {
      setError("회사명을 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        url: cleanUrl,
        company: cleanCompany,
      };
      if (keywords.trim()) body.keywords = keywords.trim();
      if (industry.trim()) body.industry = industry.trim();
      const competitorUrls = competitors.split(/[\n,，]/).map((v) => v.trim()).filter(Boolean).slice(0, 3);
      if (competitorUrls.length) body.competitors = competitorUrls;
      if (channels.length) body.channels = channels;
      // notes are for human context only — append into industry field if useful
      if (notes.trim() && !industry.trim()) {
        body.industry = notes.trim().slice(0, 120);
      }

      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as DiagnoseOk | DiagnoseErr;
      if (!res.ok || !data.ok) {
        setError(
          !data.ok
            ? data.error || "진단에 실패했습니다."
            : `진단 실패 (HTTP ${res.status})`,
        );
        return;
      }
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "네트워크 오류로 진단에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  function downloadMd() {
    if (!result) return;
    downloadBlob(result.markdown, `${baseName}.md`, "text/markdown;charset=utf-8");
    setExportMsg(`Markdown 저장: ${baseName}.md`);
  }

  function downloadDoc(kind: "brief" | "easy", format: "md" | "pdf") {
    if (!result) return;
    const md = kind === "brief" ? result.briefMarkdown : result.easyMarkdown;
    if (!md) { setExportMsg("이 결과에는 해당 문서가 없습니다. 다시 진단해 주세요."); return; }
    const label = kind === "brief" ? "방문전브리핑" : "쉬운보고서";
    if (format === "md") {
      downloadBlob(md, `${baseName}_${label}.md`, "text/markdown;charset=utf-8");
      setExportMsg(`${label} 저장: ${baseName}_${label}.md`);
    } else {
      void openPrintPdf(md, { company: result.input.company }).then(
        () => setExportMsg("인쇄 창이 열립니다. «PDF로 저장»을 선택하세요."),
        (err) => setError(err instanceof Error ? err.message : "PDF 내보내기 실패"),
      );
    }
  }

  async function downloadHtml() {
    if (!result) return;
    try {
      const html = await buildStandaloneHtml(result.markdown, {
        company: result.input.company,
      });
      downloadBlob(html, `${baseName}.html`, "text/html;charset=utf-8");
      setExportMsg(`HTML 저장: ${baseName}.html`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "HTML 내보내기 실패");
    }
  }

  async function downloadPdf() {
    if (!result) return;
    try {
      setExportMsg(
        "인쇄 창이 열립니다. 프린터를 «PDF로 저장» / «Save as PDF» 로 선택하세요.",
      );
      await openPrintPdf(result.markdown, { company: result.input.company });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF 내보내기 실패");
    }
  }

  function fillExample(which: "sangsang" | "serveon") {
    if (which === "sangsang") {
      setUrl("https://sangsangwoori.com/");
      setCompany("상상우리");
      setKeywords("AI 컨설팅, 중장년, AI 교육");
      setIndustry("AI 컨설팅·교육");
    } else {
      setUrl("https://serveon.co.kr");
      setCompany("서브온");
      setKeywords("IT 서비스, 유지보수");
      setIndustry("IT 서비스");
    }
    setShowOptional(true);
    setError(null);
    setResult(null);
  }

  return (
    <>
      <div className="home-hero">
        <p>
          홈페이지 주소와 회사명만 입력하면 AI가 <strong>검색·홈페이지·콘텐츠·전환 동선</strong>을
          분석해 컨설팅 전 개선 우선순위를 찾아드립니다. 광고를 시작하기 전에
          고객이 회사를 발견하고, 이해하고, 신뢰하고, 문의할 준비가 되었는지 확인하세요.
        </p>
      </div>

      <div className="note-banner">
        AI가 홈페이지·검색·전환 신호를 종합 분석한 <strong>광고 전 사전진단</strong>입니다.
        개선 우선순위와 실행안을 제시하며, 실제 광고·매출 성과는 실행 후 데이터로 함께 검증합니다.
      </div>

      <form className="home-card" onSubmit={onSubmit}>
        <h2>진단 정보 입력</h2>
        <p className="hint">
          필수 2항목만 채우면 됩니다. AI가 웹 검색과 심층 분석을 수행합니다.
        </p>

        <div className="ai-engine-fixed">
          <strong>AI 분석 엔진</strong>
          <span>GPT·Claude·Gemini·Grok 중 서버에 설정된 API 키로 실시간 웹 검색과 심층 분석을 수행합니다. API 키는 서버에만 안전하게 보관되며 외부에 노출되지 않습니다.</span>
        </div>

        <div className="field">
          <label htmlFor="url">
            회사 홈페이지 URL<span className="req">*</span>
          </label>
          <input
            id="url"
            name="url"
            type="url"
            inputMode="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoComplete="url"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="company">
            회사명<span className="req">*</span>
          </label>
          <input
            id="company"
            name="company"
            type="text"
            placeholder="예: 상상우리"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="organization"
            required
          />
        </div>

        <button
          type="button"
          className="optional-toggle"
          onClick={() => setShowOptional((v) => !v)}
          aria-expanded={showOptional}
        >
          {showOptional ? "▾ 추가 정보 접기" : "▸ 추가 정보 입력 (선택)"}
        </button>

        {showOptional && (
          <div className="optional-box">
            <div className="field">
              <label htmlFor="keywords">
                메인 서비스·유관 키워드 (쉼표로 구분)
              </label>
              <input
                id="keywords"
                name="keywords"
                type="text"
                placeholder="예: 병원동행, 부모님 병원동행, 케어리포트"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
              <p className="hint" style={{ margin: "6px 0 0" }}>
                첫 키워드 = 메인 서비스입니다. 네이버에서 «회사명 + 첫 키워드»
                (예: 서브온 병원동행)로 검색될 때 자사 홈이 연결되도록
                Before→After가 작성됩니다.
              </p>
            </div>
            <div className="field">
              <label htmlFor="industry">업종</label>
              <input
                id="industry"
                name="industry"
                type="text"
                placeholder="예: AI 컨설팅·교육"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="notes">메모 / 추가 설명</label>
              <textarea
                id="notes"
                name="notes"
                placeholder="진단 시 참고할 한 줄 설명 (선택)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="competitors">경쟁사 홈페이지 URL (최대 3개)</label>
              <textarea
                id="competitors"
                name="competitors"
                placeholder={"https://competitor1.com\nhttps://competitor2.com"}
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
              />
              <p className="hint" style={{ margin: "6px 0 0" }}>입력하지 않으면 AI가 웹 검색으로 최대 3개를 자동 선정합니다. 직접 입력하면 입력값이 우선됩니다.</p>
            </div>
            <fieldset className="channel-fieldset">
              <legend>사용 중인 채널</legend>
              {[
                ["naver", "네이버"], ["instagram", "인스타그램"], ["youtube", "유튜브"],
                ["google_ads", "Google Ads"], ["meta", "Meta 광고"], ["email", "이메일"],
              ].map(([value, label]) => (
                <label key={value}>
                  <input type="checkbox" checked={channels.includes(value)} onChange={(e) => setChannels((current) => e.target.checked ? [...current, value] : current.filter((v) => v !== value))} />
                  {label}
                </label>
              ))}
            </fieldset>
          </div>
        )}

        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "AI 진단 중…" : "AI 사전진단 시작하기"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() => fillExample("sangsang")}
          >
            예시: 상상우리
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() => fillExample("serveon")}
          >
            예시: 서브온
          </button>
        </div>

        {loading && (
          <div className="loading-bar" aria-hidden>
            <span />
          </div>
        )}
        {loading && (
          <div className="alert alert-info" role="status">
            홈페이지 수집과 AI 웹 검색을 진행 중입니다. 보통 30초~2분 정도 걸립니다.
          </div>
        )}
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
      </form>

      {result && (
        <section className="result-section" data-tab={tab} aria-live="polite">
          {result.businessProfile && (
            <div className="viz-card" style={{ marginBottom: 16, border: "1px solid #dbe4f0", borderRadius: 12, padding: 16 }}>
              <h3 className="viz-title">🧭 비즈니스 모델 판별 (v4)</h3>
              <p className="viz-sub">
                주 모델: <strong>{MOTION_KO[result.businessProfile.primaryMarketMotion] || result.businessProfile.primaryMarketMotion}</strong>
                {result.businessProfile.secondaryMarketMotions.length > 0 && (
                  <> · 보조: {result.businessProfile.secondaryMarketMotions.map((m) => MOTION_KO[m] || m).join(", ")}</>
                )}
                {" · 신뢰도 "}
                {result.businessProfile.confidenceLabel === "high" ? "높음" : result.businessProfile.confidenceLabel === "medium" ? "중간" : "낮음"}
                {` (${Math.round(result.businessProfile.confidence * 100)}%)`}
              </p>
              {result.businessProfile.needsConfirmation && (
                <p style={{ color: "#b45309", fontSize: 13, margin: "6px 0" }}>
                  ⚠️ 자동 분류 확인이 필요합니다. 유형이 다르면 추가 정보 입력의 업종·목표를 채워 다시 진단하세요.
                </p>
              )}
              {result.businessProfile.evidence.slice(0, 3).map((e, i) => (
                <p key={i} style={{ fontSize: 13, margin: "2px 0", color: "#475569" }}>· {e.claim}</p>
              ))}
              {result.adaptiveScores && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
                  <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>공통 온라인 기반</div>
                    <strong>{result.adaptiveScores.coreReadiness.score ?? "서술형"}</strong>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}> (제외 {result.adaptiveScores.coreReadiness.naCount})</span>
                  </div>
                  {result.adaptiveScores.journeyScores.map((j) => (
                    <div key={j.journeyId} style={{ background: "#f1f5f9", borderRadius: 8, padding: "8px 12px" }}>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{j.priority === "primary" ? "★ " : ""}{j.journeyLabel}</div>
                      <strong>{j.score ?? "서술형"}</strong>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}> (적용 {j.applicableCount} · 제외 {j.naCount})</span>
                    </div>
                  ))}
                  <div style={{ background: "#eef2ff", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>v4 종합</div>
                    <strong>{result.adaptiveScores.overallScore !== null ? `${result.adaptiveScores.overallScore}점 (${result.adaptiveScores.grade})` : result.adaptiveScores.provisional ? "분류 확인 후 확정" : "여정별 참고"}</strong>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="score-grid">
            <div className="score-card">
              <div className="label">AI 진단 점수(v3 참고)</div>
              <div className="value">{result.scores.surfaceScore}</div>
              <div className="sub">등급 {result.scores.grade}</div>
            </div>
            <div className="score-card">
              <div className="label">브랜드=서비스 연결</div>
              <div className="value">{result.scores.brandServiceBinding}</div>
              <div className="sub">{result.scores.brandServiceLevel}</div>
            </div>
            <div className="score-card">
              <div className="label">네이버 가이드</div>
              <div className="value">{result.scores.naverGuideScore}</div>
              <div className="sub">신뢰도 {result.scores.confidence}</div>
            </div>
          </div>

          <div className="summary-box">{result.summary}</div>

          <nav className="result-tabs" role="tablist">
            {([
              ["summary", "📊 요약·AI전략"],
              ["search", "🔑 검색·키워드"],
              ["biz", "🏆 전환·경쟁·로컬"],
              ["action", "🚀 실행 계획"],
              ["raw", "📄 전체 원문"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={"rtab" + (tab === key ? " on" : "")}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          {result.aiPrecheck?.enabled && (
            <div className="viz-card ai-strategy-card tab-item grp-summary">
              <h3 className="viz-title">AI 심층 전략 · {result.aiPrecheck.model}</h3>
              <p className="viz-sub">{result.aiPrecheck.summary}</p>
              {result.aiPrecheck.priorities.length > 0 && (
                <ol className="ai-priority-list">
                  {result.aiPrecheck.priorities.map((item, index) => (
                    <li key={`${item.title}-${index}`}><strong>{item.title}</strong><span>{item.reason}</span><em>실행: {item.action}</em></li>
                  ))}
                </ol>
              )}
              {result.aiPrecheck.messaging && (
                <div className="ai-message-proposal">
                  <b>추천 첫 화면 문구</b>
                  <strong>{result.aiPrecheck.messaging.headline}</strong>
                  <span>{result.aiPrecheck.messaging.subcopy}</span>
                  <em>CTA · {result.aiPrecheck.messaging.primaryCta}</em>
                </div>
              )}
              {result.aiPrecheck.competitorCandidates.length > 0 && (
                <div className="ai-competitors"><b>AI가 검색한 경쟁사 후보</b>{result.aiPrecheck.competitorCandidates.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer">{item.name}</a>)}</div>
              )}
            </div>
          )}

          <div className="export-bar">
            <span className="export-label">보고서 저장</span>
            <button type="button" className="btn btn-export" onClick={downloadMd}>
              ⬇ Markdown (.md)
            </button>
            <button
              type="button"
              className="btn btn-export"
              onClick={() => void downloadHtml()}
            >
              ⬇ HTML (.html)
            </button>
            <button
              type="button"
              className="btn btn-export"
              onClick={() => void downloadPdf()}
            >
              ⬇ PDF (인쇄 저장)
            </button>
            <span className="export-label" style={{ marginLeft: 12 }}>사전진단 팩</span>
            <button type="button" className="btn btn-export" onClick={() => downloadDoc("easy", "md")}>
              ⬇ 쉬운 보고서 (.md)
            </button>
            <button type="button" className="btn btn-export" onClick={() => downloadDoc("easy", "pdf")}>
              ⬇ 쉬운 보고서 (PDF)
            </button>
            <button type="button" className="btn btn-export" onClick={() => downloadDoc("brief", "md")}>
              ⬇ 방문 전 브리핑 (.md)
            </button>
            <button type="button" className="btn btn-export" onClick={() => downloadDoc("brief", "pdf")}>
              ⬇ 방문 전 브리핑 (PDF)
            </button>
          </div>

          {exportMsg && (
            <div className="alert alert-info" role="status">
              {exportMsg}
            </div>
          )}

          {result.hero && result.conversion && result.adReadiness && (
            <div className="core-diagnostics tab-item grp-biz">
              {[
                { title: "첫 화면 메시지", score: result.hero.score, summary: result.hero.summary, checks: result.hero.checks },
                { title: "전환 동선", score: result.conversion.score, summary: result.conversion.summary, checks: result.conversion.checks },
                { title: `광고 집행 준비도 · ${result.adReadiness.level}`, score: result.adReadiness.score, summary: result.adReadiness.summary, checks: result.adReadiness.checks },
              ].map((report) => (
                <div className="core-diagnostic-card" key={report.title}>
                  <div className="core-diagnostic-head">
                    <strong>{report.title}</strong>
                    <span style={{ color: scoreColor(report.score) }}>{report.score}</span>
                  </div>
                  <p>{report.summary}</p>
                  <ul>
                    {report.checks.slice(0, 5).map((check) => {
                      const badge = DIAG_BADGE[check.status] || DIAG_BADGE.manual;
                      return <li key={check.id}><span className={`nb-badge ${badge.cls}`}>{badge.label}</span><span><b>{check.title}</b>{check.detail}</span></li>;
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {result.servicePages && (
            <div className="viz-card tab-item grp-biz">
              <h3 className="viz-title">서비스·상품 페이지 상세 진단</h3>
              <p className="viz-sub">{result.servicePages.summary}</p>
              {result.servicePages.pages.length > 0 ? (
                <div className="ba-table-wrap">
                  <table className="ba-table">
                    <thead><tr><th>페이지</th><th>H1</th><th>점수</th><th>우선 보완</th></tr></thead>
                    <tbody>
                      {result.servicePages.pages.map((page) => (
                        <tr key={page.url}>
                          <td><a href={page.url} target="_blank" rel="noreferrer">{page.title || new URL(page.url).pathname}</a></td>
                          <td>{page.h1 || "미검출"}</td>
                          <td><strong style={{ color: scoreColor(page.score) }}>{page.score}</strong></td>
                          <td>{page.checks.filter((c) => c.status !== "pass").slice(0, 3).map((c) => c.title).join(", ") || "양호"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="empty-diagnostic">서비스·상품 전용 페이지가 없다면 광고 전에 핵심 서비스별 랜딩페이지부터 준비하세요.</p>}
            </div>
          )}

          {result.competitorComparison?.enabled && (
            <div className="viz-card tab-item grp-biz">
              <h3 className="viz-title">경쟁사 비교 · {result.competitorComparison.source === "ai" ? "AI 자동 선정" : "직접 입력"}</h3>
              <p className="viz-sub">{result.competitorComparison.summary}</p>
              {result.competitorComparison.competitors.length > 0 && (
                <ul className="kw-note" style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
                  {result.competitorComparison.competitors.map((c) => (
                    <li key={c.url}>
                      {c.error
                        ? <>{c.name || c.url} — <span style={{ opacity: 0.7 }}>{c.error}</span></>
                        : <a href={c.url} target="_blank" rel="noopener noreferrer">{c.name || c.title || c.url}</a>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="ba-table-wrap">
                <table className="ba-table">
                  <thead><tr><th>비교 항목</th><th>우리 홈페이지</th><th>경쟁사</th><th>보완 우선순위</th></tr></thead>
                  <tbody>{result.competitorComparison.comparison.map((row) => <tr key={row.item}><td className="ba-el">{row.item}</td><td>{row.ours}</td><td>{row.competitors}</td><td>{row.interpretation}</td></tr>)}</tbody>
                </table>
              </div>
              {result.competitorComparison.competitors.some((c) => c.error) && <p className="kw-note">일부 경쟁사 주소는 수집하지 못했으며 해당 항목만 비교에서 제외했습니다.</p>}
            </div>
          )}

          {result.axes && result.axes.length > 0 && (
            <div className="viz-card tab-item grp-summary">
              <h3 className="viz-title">5개 영역 AI 진단 점수</h3>
              <div className="axis-bars">
                {result.axes.map((a) => (
                  <div className="axis-row" key={a.key}>
                    <span className="axis-name">{a.label}</span>
                    <span className="axis-track">
                      <span
                        className="axis-fill"
                        style={{
                          width: `${a.score}%`,
                          background: scoreColor(a.score),
                        }}
                      />
                    </span>
                    <span
                      className="axis-score"
                      style={{ color: scoreColor(a.score) }}
                    >
                      {a.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.keywordStrategy && (
            <div className="viz-card tab-item grp-search">
              <h3 className="viz-title">
                키워드 전략 — 회사명이 아닌 핵심 키워드로 노출되기
              </h3>
              <p className="viz-sub">
                산출: {result.keywordStrategy.source === "ai" ? `AI (${result.keywordStrategy.model ?? "Claude"})` : "휴리스틱(본문 분석)"} · 핵심 서비스 키워드{" "}
                <strong>{result.keywordStrategy.primaryService}</strong>
                {result.keywordStrategy.regions.length > 0 &&
                  ` · 지역: ${result.keywordStrategy.regions.join(", ")}`}
              </p>
              <div className="kw-tiers">
                {([
                  [1, "1층 · 핵심 전환", result.keywordStrategy.tier1],
                  [2, "2층 · 상황·니즈 (승부처)", result.keywordStrategy.tier2],
                  [3, "3층 · 지역·B2B", result.keywordStrategy.tier3],
                ] as const).map(([tier, title, items]) => (
                  <div className={tierClass(tier)} key={tier}>
                    <div className="kw-tier-head">{title}</div>
                    <ul>
                      {items.map((it, i) => (
                        <li key={i}>
                          <span className="kw-word">{it.keyword}</span>
                          {it.intent && <span className="kw-intent">{it.intent}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="ba-grid">
                <div className="ba-item">
                  <span className="ba-tag">title</span>
                  <code>{result.keywordStrategy.titleAfter}</code>
                </div>
                <div className="ba-item">
                  <span className="ba-tag">description</span>
                  <code>{result.keywordStrategy.metaAfter}</code>
                </div>
                <div className="ba-item">
                  <span className="ba-tag">H1</span>
                  <code>{result.keywordStrategy.h1After}</code>
                </div>
              </div>
              {result.keywordStrategy.notes.map((n, i) => (
                <p className="kw-note" key={i}>
                  {n}
                </p>
              ))}
            </div>
          )}

          {result.axes && result.axes.some((a) => a.strengths?.length || a.weaknesses?.length) && (
            <div className="viz-card tab-item grp-search">
              <h3 className="viz-title">영역별 상세 진단 (강점·약점·개선)</h3>
              <div className="axis-detail-list">
                {result.axes.map((a) => (
                  <div className="axis-detail" key={a.key}>
                    <div className="axis-detail-head">
                      <span className="ad-name">{a.label}</span>
                      <span className="ad-track">
                        <span
                          className="ad-fill"
                          style={{ width: `${a.score}%`, background: scoreColor(a.score) }}
                        />
                      </span>
                      <span className="ad-score" style={{ color: scoreColor(a.score) }}>
                        {a.score}
                      </span>
                    </div>
                    <div className="ad-cols">
                      <div className="ad-col ad-strong">
                        <span className="ad-col-h">강점</span>
                        {a.strengths.length ? (
                          <ul>{a.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        ) : (
                          <p className="ad-empty">—</p>
                        )}
                      </div>
                      <div className="ad-col ad-weak">
                        <span className="ad-col-h">약점</span>
                        {a.weaknesses.length ? (
                          <ul>{a.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        ) : (
                          <p className="ad-empty">—</p>
                        )}
                      </div>
                      <div className="ad-col ad-rec">
                        <span className="ad-col-h">개선 제안</span>
                        {a.recommendations.length ? (
                          <ul>{a.recommendations.map((s, i) => <li key={i}>{s}</li>)}</ul>
                        ) : (
                          <p className="ad-empty">—</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.local && result.local.items.length > 0 && (
            <div className="viz-card tab-item grp-biz">
              <h3 className="viz-title">
                홈페이지 로컬 SEO 준비도 · {result.local.score}/100
              </h3>
              <p className="viz-sub">
                홈페이지에서 확인되는 상호·주소·전화, 구조화 데이터, 지도·영업시간 신호를 점검합니다.
              </p>
              <div className="panel-plan">
                <div className="pp-title">홈페이지 점검 기반 우선 지침</div>
                <ol>{result.local.panelPlan.map((p, i) => <li key={i}><strong>{p.step}</strong><span className="pp-why">{p.why}</span></li>)}</ol>
              </div>
                {result.local.googleCheck && (
                  <div className={"live-search " + (!result.local.googleCheck.performed ? "ls-idle" : result.local.googleCheck.status === "present" ? "ls-found" : result.local.googleCheck.status === "absent" ? "ls-missing" : "ls-idle")}>
                    <div className="ls-head">
                      {!result.local.googleCheck.performed ? "🔍 구글 지도·지식 패널 (AI 실검색)" : result.local.googleCheck.status === "present" ? "✅ 구글 패널 노출 확인 (AI 실검색)" : result.local.googleCheck.status === "absent" ? "⚠️ 구글 패널 미확인 (AI 실검색)" : "🔍 구글 패널 확인 (AI 실검색)"}
                    </div>
                    <div className="ls-summary">{result.local.googleCheck.detail}</div>
                    {result.local.googleCheck.guidance && <div className="ls-summary" style={{ marginTop: 4, color: "#0a326f" }}>→ {result.local.googleCheck.guidance}</div>}
                  </div>
                )}
                <div className="nap-row">
                  <span className="nap-chip">📞 전화 {result.local.nap.phones.length ? result.local.nap.phones.join(", ") : "미검출"}</span>
                  <span className="nap-chip">📍 주소 {result.local.nap.addresses.length ? result.local.nap.addresses.join(", ") : "미검출"}</span>
                  <span className={`nap-chip ${result.local.hasOrgSchema ? "nap-ok" : "nap-no"}`}>Organization {result.local.hasOrgSchema ? "○" : "×"}</span>
                  <span className={`nap-chip ${result.local.hasLocalBusinessSchema ? "nap-ok" : "nap-no"}`}>LocalBusiness {result.local.hasLocalBusinessSchema ? "○" : "×"}</span>
                </div>
                <table className="naver-table">
                  <thead>
                    <tr><th>상태</th><th>항목</th><th>조치</th></tr>
                  </thead>
                  <tbody>
                    {result.local.items.map((it, i) => {
                      const b = LOCAL_BADGE[it.status] ?? LOCAL_BADGE.manual;
                      return (
                        <tr key={i}>
                          <td><span className={`nb-badge ${b.cls}`}>{b.label}</span></td>
                          <td><strong>{it.title}</strong><span className="nt-cat">{it.category}</span></td>
                          <td className="nt-action">{it.action}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="jsonld-block">
                  <div className="jsonld-h">Organization JSON-LD (홈 &lt;head&gt;에 삽입)</div>
                  <pre>{result.local.organizationJsonLd}</pre>
                  <div className="jsonld-h">LocalBusiness JSON-LD (지도 패널용)</div>
                  <pre>{result.local.localBusinessJsonLd}</pre>
                </div>
                <div className="verify-links">
                  {result.local.verifyLinks.map((v, i) => (
                    <a key={i} href={v.url} target="_blank" rel="noreferrer" className="verify-chip">
                      🔗 {v.label}
                    </a>
                  ))}
                </div>
            </div>
          )}

          {result.beforeAfter && result.beforeAfter.length > 0 && (
            <div className="viz-card tab-item grp-search">
              <h3 className="viz-title">Before → After 개선안 (검색 노출 강화)</h3>
              <div className="ba-table-wrap">
                <table className="ba-table">
                  <thead>
                    <tr>
                      <th>요소</th>
                      <th>현재 (Before)</th>
                      <th>개선안 (After)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.beforeAfter.map((b, i) => (
                      <tr key={i}>
                        <td className="ba-el">{b.element}</td>
                        <td className="ba-before">{b.before}</td>
                        <td className="ba-after">{b.afterA}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.quickWins && result.quickWins.length > 0 && (
            <div className="viz-card tab-item grp-action">
              <h3 className="viz-title">Quick Wins — 즉시 실행 과제</h3>
              <table className="qw-table">
                <thead>
                  <tr>
                    <th>과제</th>
                    <th>임팩트</th>
                    <th>노력</th>
                  </tr>
                </thead>
                <tbody>
                  {result.quickWins.map((q, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{q.title}</strong>
                        <span className="qw-desc">{q.description}</span>
                      </td>
                      <td>
                        <span className={`qw-badge imp-${q.impact}`}>{impactBadge(q.impact)}</span>
                      </td>
                      <td>
                        <span className={`qw-badge eff-${q.effort}`}>{impactBadge(q.effort)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.roadmap && result.roadmap.length > 0 && (
            <div className="viz-card tab-item grp-action">
              <h3 className="viz-title">30 / 60 / 90일 실행 로드맵</h3>
              <div className="roadmap-grid">
                {result.roadmap.map((r) => (
                  <div className={`rm-col rm-${r.phase}`} key={r.phase}>
                    <div className="rm-phase">{r.phase}일</div>
                    <div className="rm-title">{r.title}</div>
                    <p className="rm-desc">{r.description}</p>
                    <div className="rm-outcome">🎯 {r.expectedOutcome}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.naver && result.naver.items.length > 0 && (
            <div className="viz-card tab-item grp-search">
              <h3 className="viz-title">
                네이버 서치어드바이저 점검 · {result.naver.score}/100
              </h3>
              <div className="naver-summary">
                <span className="ns-chip ns-pass">통과 {result.naver.pass}</span>
                <span className="ns-chip ns-warn">주의 {result.naver.warn}</span>
                <span className="ns-chip ns-fail">미흡 {result.naver.fail}</span>
                <span className="ns-chip ns-manual">수동 {result.naver.manual}</span>
              </div>
              <div className="naver-bar">
                {(["pass", "warn", "fail", "manual"] as const).map((k) => {
                  const total =
                    result.naver!.pass + result.naver!.warn + result.naver!.fail + result.naver!.manual;
                  const val = result.naver![k];
                  return val > 0 ? (
                    <span
                      key={k}
                      className={`nbar-seg nbar-${k}`}
                      style={{ width: `${(val / total) * 100}%` }}
                      title={`${NAVER_BADGE[k].label} ${val}`}
                    />
                  ) : null;
                })}
              </div>
              <details className="naver-details">
                <summary>항목별 점검 결과 {result.naver.items.length}건 펼치기</summary>
                <table className="naver-table">
                  <thead>
                    <tr>
                      <th>상태</th>
                      <th>항목</th>
                      <th>조치</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.naver.items.map((it, i) => {
                      const b = NAVER_BADGE[it.status] ?? NAVER_BADGE.manual;
                      return (
                        <tr key={i}>
                          <td>
                            <span className={`nb-badge ${b.cls}`}>{b.label}</span>
                          </td>
                          <td>
                            <strong>{it.title}</strong>
                            <span className="nt-cat">{it.category}</span>
                          </td>
                          <td className="nt-action">{it.action}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            </div>
          )}

          <details className="report-details tab-item grp-raw">
            <summary>전체 보고서 원문 (Markdown 전체 · 텍스트)</summary>
            <div className="report-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.markdown}
              </ReactMarkdown>
            </div>
          </details>
        </section>
      )}
    </>
  );
}
