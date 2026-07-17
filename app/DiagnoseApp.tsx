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
type LocalSeo = {
  score: number;
  ok: number; warn: number; missing: number; manual: number;
  nap: { name: string; phones: string[]; addresses: string[]; region: string };
  schemaTypes: string[];
  hasOrgSchema: boolean;
  hasLocalBusinessSchema: boolean;
  liveSearch: {
    performed: boolean; method: string; found: boolean; reason?: string; summary: string;
    match: { name: string; address: string; phone: string; rating: number | null; reviewCount: number | null; mapsUri: string; confidence: string } | null;
  };
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
  input: { url: string; company: string; keywords?: string[]; industry?: string };
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

type DiagnoseErr = { ok: false; error: string };

export function DiagnoseApp() {
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [keywords, setKeywords] = useState("");
  const [industry, setIndustry] = useState("");
  const [notes, setNotes] = useState("");
  const [showOptional, setShowOptional] = useState(false);

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
        <h1>홈페이지 검색 노출 진단</h1>
        <p>
          회사 홈페이지 주소와 회사명만 넣으면, 네이버·구글에서 우리 회사가{" "}
          <strong>회사명이 아니라 핵심 사업 키워드</strong>로도 검색에 노출되는지
          진단합니다. 무엇이 문제이고 <strong>무엇을 어떻게 고쳐야 하는지</strong>{" "}
          점수·표·개선안이 담긴 보고서로 알려드립니다 (Markdown · HTML · PDF 저장).
        </p>
      </div>

      <div className="note-banner">
        점수는 홈페이지 HTML 표면 신호 기준입니다. 네이버·구글의{" "}
        <strong>실제 검색 순위 측정이 아닙니다</strong>.
      </div>

      <form className="home-card" onSubmit={onSubmit}>
        <h2>진단 정보 입력</h2>
        <p className="hint">
          필수 2항목만 채우면 됩니다. 예시를 눌러 바로 시험해 보세요.
        </p>

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
          </div>
        )}

        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "진단 중…" : "진단 시작"}
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
            홈페이지를 분석하는 중입니다. 보통 10~40초 정도 걸립니다.
          </div>
        )}
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
      </form>

      {result && (
        <section className="result-section" aria-live="polite">
          <div className="score-grid">
            <div className="score-card">
              <div className="label">표면 점수</div>
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
          </div>

          {exportMsg && (
            <div className="alert alert-info" role="status">
              {exportMsg}
            </div>
          )}

          {result.axes && result.axes.length > 0 && (
            <div className="viz-card">
              <h3 className="viz-title">5개 영역 표면 점수</h3>
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
            <div className="viz-card">
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
            <div className="viz-card">
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
            <div className="viz-card">
              <h3 className="viz-title">
                구글 지도·지식 패널 & 로컬 SEO · {result.local.score}/100
              </h3>
              <p className="viz-sub">
                구글에서 <strong>회사명 검색 시 우측 지도·회사정보 패널</strong>이 뜨게 하고,
                네이버 플레이스·리뷰로 신뢰를 높이는 전략입니다.
              </p>
              {result.local.liveSearch && (
                <div
                  className={
                    "live-search " +
                    (!result.local.liveSearch.performed
                      ? "ls-idle"
                      : result.local.liveSearch.found
                        ? "ls-found"
                        : "ls-missing")
                  }
                >
                  <div className="ls-head">
                    {!result.local.liveSearch.performed
                      ? "🔍 구글 맵 자동 조회"
                      : result.local.liveSearch.found
                        ? "✅ 구글 맵 실검색 결과 — 등록 확인됨"
                        : "⚠️ 구글 맵 실검색 결과 — 미노출"}
                  </div>
                  <div className="ls-summary">{result.local.liveSearch.summary}</div>
                  {result.local.liveSearch.found && result.local.liveSearch.match && (
                    <div className="ls-facts">
                      {result.local.liveSearch.match.rating != null && (
                        <span className="ls-fact">
                          ★ {result.local.liveSearch.match.rating} · 리뷰 {result.local.liveSearch.match.reviewCount ?? 0}
                        </span>
                      )}
                      {result.local.liveSearch.match.address && (
                        <span className="ls-fact">📍 {result.local.liveSearch.match.address}</span>
                      )}
                      {result.local.liveSearch.match.mapsUri && (
                        <a className="ls-map" href={result.local.liveSearch.match.mapsUri} target="_blank" rel="noreferrer">
                          구글 지도에서 보기 →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="nap-row">
                <span className="nap-chip">
                  📞 전화 {result.local.nap.phones.length ? result.local.nap.phones.join(", ") : "미검출"}
                </span>
                <span className="nap-chip">
                  📍 주소 {result.local.nap.addresses.length ? result.local.nap.addresses.join(", ") : "미검출"}
                </span>
                <span className={`nap-chip ${result.local.hasOrgSchema ? "nap-ok" : "nap-no"}`}>
                  Organization {result.local.hasOrgSchema ? "○" : "×"}
                </span>
                <span className={`nap-chip ${result.local.hasLocalBusinessSchema ? "nap-ok" : "nap-no"}`}>
                  LocalBusiness {result.local.hasLocalBusinessSchema ? "○" : "×"}
                </span>
              </div>

              <div className="panel-plan">
                <div className="pp-title">🗺 구글 지도·지식 패널 노출 전략 (순서대로)</div>
                <ol>
                  {result.local.panelPlan.map((p, i) => (
                    <li key={i}>
                      <strong>{p.step}</strong>
                      <span className="pp-why">{p.why}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <details className="local-details">
                <summary>로컬 SEO 점검 {result.local.items.length}건 · 붙여넣기용 구조화 데이터</summary>
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
              </details>
            </div>
          )}

          {result.beforeAfter && result.beforeAfter.length > 0 && (
            <div className="viz-card">
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
            <div className="viz-card">
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
            <div className="viz-card">
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
            <div className="viz-card">
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

          <details className="report-details">
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
