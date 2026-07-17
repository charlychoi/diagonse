"use client";

import { useMemo, useState } from "react";
import {
  buildStandaloneHtml,
  downloadBlob,
  openPrintPdf,
  reportBaseName,
} from "../lib/export-report";

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
  input: { url: string; company: string; keywords?: string[]; industry?: string };
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

          <div className="preview">
            <pre>{result.markdown}</pre>
          </div>
        </section>
      )}
    </>
  );
}
