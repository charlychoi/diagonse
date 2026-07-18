import { crawlAndParse, type ParsedSiteSignals } from "./crawl";
import type { CompetitorComparisonReport, DiagnosisInput } from "./types";

function yes(value: boolean): string { return value ? "있음" : "없음"; }

export async function evaluateCompetitors(ours: ParsedSiteSignals, input: DiagnosisInput, source: "user" | "ai" | "none" = "user"): Promise<CompetitorComparisonReport> {
  const urls = (input.competitors || []).slice(0, 3);
  if (!urls.length) return { enabled: false, source: "none", competitors: [], comparison: [], summary: "경쟁사 URL을 입력하지 않았고 AI 자동 후보도 없어 비교를 생략했습니다.", topActions: [] };
  const results = await Promise.all(urls.map(async (url) => {
    try {
      const s = await crawlAndParse(url);
      if (!s.pageCountCrawled) return { url, title: null, h1: null, hasDescription: false, hasCta: false, hasForm: false, hasBlog: false, hasJsonLd: false, hasContact: false, wordCount: 0, strengths: [], error: "홈페이지 HTML을 수집하지 못했습니다." };
      const strengths = [s.description && "메타 설명", s.hasCtaHints && "CTA", s.hasForm && "폼", s.hasBlog && "콘텐츠 허브", s.hasJsonLd && "구조화 데이터", s.hasContact && "문의 경로"].filter(Boolean) as string[];
      return { url: s.url, title: s.title, h1: s.h1s[0] ?? null, hasDescription: Boolean(s.description), hasCta: s.hasCtaHints, hasForm: s.hasForm, hasBlog: s.hasBlog, hasJsonLd: s.hasJsonLd, hasContact: s.hasContact, wordCount: s.wordCount, strengths };
    } catch {
      return { url, title: null, h1: null, hasDescription: false, hasCta: false, hasForm: false, hasBlog: false, hasJsonLd: false, hasContact: false, wordCount: 0, strengths: [], error: "경쟁사 URL 분석 중 오류가 발생했습니다." };
    }
  }));
  const valid = results.filter((r) => !r.error);
  const count = (key: "hasDescription" | "hasCta" | "hasForm" | "hasBlog" | "hasJsonLd" | "hasContact") => valid.filter((r) => r[key]).length;
  const n = valid.length;
  const comparison = [
    { item: "메타 설명", ours: yes(Boolean(ours.description)), competitors: `${count("hasDescription")}/${n}개`, interpretation: !ours.description && count("hasDescription") ? "우리 홈페이지의 검색·공유 설명을 우선 보강하세요." : "경쟁사와 비슷하거나 양호한 기본 설명 신호입니다." },
    { item: "명확한 CTA", ours: yes(ours.hasCtaHints), competitors: `${count("hasCta")}/${n}개`, interpretation: !ours.hasCtaHints && count("hasCta") ? "경쟁사 대비 행동 유도 문구가 약합니다." : "CTA 존재 여부는 경쟁사와 비슷하거나 양호합니다." },
    { item: "문의 폼", ours: yes(ours.hasForm), competitors: `${count("hasForm")}/${n}개`, interpretation: !ours.hasForm && count("hasForm") ? "간단한 문의 폼 또는 예약 연결을 우선 검토하세요." : "문의 수집 구조는 경쟁사와 비슷하거나 양호합니다." },
    { item: "콘텐츠 허브", ours: yes(ours.hasBlog), competitors: `${count("hasBlog")}/${n}개`, interpretation: !ours.hasBlog && count("hasBlog") ? "경쟁사 대비 검색 유입을 축적할 콘텐츠 허브가 부족합니다." : "콘텐츠 허브 신호는 경쟁사와 비슷하거나 양호합니다." },
    { item: "구조화 데이터", ours: yes(ours.hasJsonLd), competitors: `${count("hasJsonLd")}/${n}개`, interpretation: !ours.hasJsonLd && count("hasJsonLd") ? "Organization·서비스·FAQ 스키마를 보강하세요." : "구조화 데이터 신호는 경쟁사와 비슷하거나 양호합니다." },
    { item: "본문 분량", ours: `${ours.wordCount}단어`, competitors: n ? `평균 ${Math.round(valid.reduce((s, r) => s + r.wordCount, 0) / n)}단어` : "비교 불가", interpretation: n && ours.wordCount < valid.reduce((s, r) => s + r.wordCount, 0) / n ? "경쟁사 대비 서비스 설명과 신뢰 콘텐츠를 더 구체화할 여지가 있습니다." : "본문 분량은 경쟁사 평균과 비슷하거나 많습니다." },
  ];
  const topActions = comparison.filter((c) => /우선|부족|보강|여지/.test(c.interpretation)).map((c) => c.interpretation).slice(0, 4);
  return { enabled: true, source, competitors: results, comparison, summary: valid.length ? `${source === "ai" ? "AI 웹 검색이 자동 선정한" : "사용자가 입력한"} ${valid.length}개 경쟁사 홈페이지의 공개 표면 신호와 비교했습니다. 실제 매출·광고 성과가 아닌 보완 우선순위 참고용입니다.` : "경쟁사 홈페이지를 수집하지 못해 비교하지 않았습니다.", topActions };
}
