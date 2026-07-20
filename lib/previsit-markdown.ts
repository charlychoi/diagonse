/**
 * v4.2 — 방문 전 브리핑 팩 · 사전진단 요약 Markdown 생성
 * (사전진단 "상세 보고서"는 별도 생성하지 않고 기존 markdownReport를 그대로 사용한다)
 * PDF는 기존 openPrintPdf(markdown) 경로 재사용.
 */
import type { PrevisitQualityReport } from "./previsit-quality";
import { qualityFlagLabel } from "./previsit-quality";
import type { DiagnosisResult } from "./types";
import { MARKET_MOTION_LABEL } from "./business-profile-types";

export function buildBriefMarkdown(
  result: Omit<DiagnosisResult, "markdownReport">,
  q: PrevisitQualityReport,
): string {
  const b = q.previsitBrief;
  const date = new Date(result.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  const lines: string[] = [
    `# 방문 전 브리핑 팩 — ${result.input.company || result.siteTitle || ""}`,
    ``,
    `> ${date} · 사전진단 상세 보고서 기반 자동 생성${q.source === "ai" ? ` (AI: ${q.model})` : " (규칙 기반)"} · 컨설턴트 전용`,
    ``,
    `## 1. 기업 스냅샷`,
    ``,
    b.companySnapshot,
    ``,
    `- 비즈니스 성격: **${MARKET_MOTION_LABEL[result.businessProfile.primaryMarketMotion]}**${result.businessProfile.secondaryMarketMotions.length ? ` (+ ${result.businessProfile.secondaryMarketMotions.map((m) => MARKET_MOTION_LABEL[m]).join(", ")})` : ""}`,
    `- 판별 확신도: ${result.businessProfile.confidenceLabel === "high" ? "높음" : result.businessProfile.confidenceLabel === "medium" ? "중간" : "낮음 — 미팅에서 유형 확인 필요"}`,
    ``,
    `## 2. 채널 현황`,
    ``,
    ...b.channelSnapshot.map((c) => `- ${c}`),
    ``,
    `## 3. 예상 페인포인트`,
    ``,
    `| 예상 이슈 | 진단 근거 |`,
    `| --- | --- |`,
    ...b.expectedPainPoints.map((p) => `| ${p.point} | ${p.evidence} |`),
    ``,
    `## 4. 미팅 확인 질문`,
    ``,
    ...b.meetingQuestions.map((question, i) => `${i + 1}. ${question}`),
    ``,
    `## 5. 미팅 강조 포인트`,
    ``,
    ...b.talkingPoints.map((t) => `- ${t}`),
  ];
  const notableFlags = q.qualityFlags.filter((f) => f.code !== "OK");
  if (notableFlags.length) {
    lines.push(``, `## 6. 진단 유의사항`, ``);
    notableFlags.forEach((f) => lines.push(`- **${qualityFlagLabel(f.code)}:** ${f.message}`));
  }
  return lines.join("\n");
}

export function buildSummaryMarkdown(
  result: Omit<DiagnosisResult, "markdownReport">,
  q: PrevisitQualityReport,
): string {
  const e = q.summary;
  const a = result.adaptiveScores;
  const scoreLine = (label: string, score: number | null) =>
    `| ${label} | ${score === null ? "점수 대신 설명으로 안내" : `${score}점 / 100점`} |`;
  return [
    `# 사전진단 요약`,
    ``,
    `**${result.input.company || result.siteTitle || ""}** · ${new Date(result.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}`,
    ``,
    `> 이 문서는 「사전진단 상세 보고서」의 내용을 쉬운 말로 정리한 요약입니다. 자세한 근거와 항목별 점검표는 상세 보고서를 확인하세요.`,
    ``,
    `## 한눈에 보는 결론`,
    ``,
    `> **${e.headline}**`,
    ``,
    e.whatWeChecked,
    ``,
    `## 점수 요약`,
    ``,
    `| 영역 | 결과 |`,
    `| --- | --- |`,
    scoreLine("기본기 (검색에 잘 나오게 하는 준비)", a.coreReadiness.score),
    ...a.journeyScores.map((j) => scoreLine(`고객 여정: ${j.journeyLabel}`, j.score)),
    ``,
    a.provisional ? `> 아직 회사 유형 확인이 끝나지 않아 **임시 결과**입니다. 컨설턴트와 확인 후 확정됩니다.` : ``,
    ``,
    `## 지금 가장 중요한 것 ${e.topRisks.length}가지`,
    ``,
    ...e.topRisks.flatMap((r, i) => [
      `### ${i + 1}. ${r.title}`,
      ``,
      r.whyPlain,
      ``,
      `**이번 주에 할 일:** ${r.todo}`,
      ``,
    ]),
    `## 바로 효과 보는 작은 조치들`,
    ``,
    ...e.quickWinsPlain.map((w) => `- ${w}`),
    ``,
    `---`,
    ``,
    `이 진단은 홈페이지에 공개된 정보만으로 분석한 결과입니다. 실제 매출·광고 성과와는 다를 수 있으며, 자세한 내용은 상세 보고서와 컨설턴트 상담으로 확인하세요.`,
  ].filter((l) => l !== undefined).join("\n");
}
