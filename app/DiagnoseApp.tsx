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

type AxisScore = { key: string; score: number; label: string };
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
        <h1>마케팅 사전진단</h1>
        <p>
          회사 홈페이지 주소와 회사명만 입력하면, 온라인 마케팅·네이버 브랜드 검색
          신호를 분석한 보고서를 <strong>Markdown · HTML · PDF</strong>로 받을 수
          있습니다. 별도 설치·스킬 등록이 필요 없습니다.
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

          <details className="report-details">
            <summary>전체 상세 보고서 펼치기 (표·체크리스트 포함)</summary>
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
