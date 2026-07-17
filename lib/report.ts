import { AXIS_META, type DiagnosisResult } from "./types";

function impactLabel(v: string): string {
  if (v === "high") return "높음";
  if (v === "medium") return "중간";
  return "낮음";
}

/** Build Full Diagnosis Report in Markdown (PRD report template) */
export function buildMarkdownReport(
  result: Omit<DiagnosisResult, "markdownReport"> & { markdownReport?: string },
): string {
  const lines: string[] = [];
  const date = new Date(result.createdAt).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });

  lines.push(`# MarkDiag 마케팅 진단 보고서`);
  lines.push(``);
  lines.push(`## 1. Cover`);
  lines.push(``);
  lines.push(`| 항목 | 내용 |`);
  lines.push(`|------|------|`);
  lines.push(`| 대상 URL | ${result.input.url} |`);
  lines.push(`| 사이트 타이틀 | ${result.siteTitle ?? "(없음)"} |`);
  lines.push(`| 진단 ID | \`${result.id}\` |`);
  lines.push(`| 생성 시각 | ${date} |`);
  lines.push(
    `| 표면 신호 점수 | **${result.overallScore} / 100** (등급 ${result.grade}) |`,
  );
  if (result.reliability) {
    lines.push(`| 점수 척도 | ${result.reliability.scaleLabel} (${result.reliability.scaleId}) |`);
    lines.push(`| 신뢰도 | ${result.reliability.confidence} — ${result.reliability.confidenceReason} |`);
    lines.push(`| 원점수→보정 | ${result.reliability.rawScore} → ${result.overallScore} |`);
    if (result.reliability.expectedStructureRange) {
      const r = result.reliability.expectedStructureRange;
      lines.push(
        `| 구조 점수 예상 대역 | 약 ${r.low}~${r.high} (6대 실측 시, 참고용) |`,
      );
    }
  }
  if (result.input.industry) {
    lines.push(`| 산업 | ${result.input.industry} |`);
  }
  if (result.input.targetCountry) {
    lines.push(`| 타겟 국가 | ${result.input.targetCountry} |`);
  }
  if (result.input.keywords?.length) {
    lines.push(`| 키워드 | ${result.input.keywords.join(", ")} |`);
  }
  if (result.input.channels?.length) {
    lines.push(`| 마케팅 채널 | ${result.input.channels.join(", ")} |`);
  }
  lines.push(``);
  lines.push(
    `> **주의:** 이 점수는 URL HTML **표면 신호 점수**입니다. 6대 자가진단의 **구조 진단 점수**와 직접 비교·평균하지 마세요. 컨설팅 최종 기준은 구조 진단입니다.`,
  );
  lines.push(``);

  lines.push(`## 2. Executive Summary`);
  lines.push(``);
  lines.push(result.executiveSummary);
  if (result.reliability) {
    lines.push(``);
    lines.push(result.reliability.crossScaleNote);
    lines.push(``);
    lines.push(`**다음 단계:** ${result.reliability.nextStep}`);
  }
  lines.push(``);

  lines.push(`## 3. Overall Score Card`);
  lines.push(``);
  lines.push(`| 축 | 점수 |`);
  lines.push(`|----|------|`);
  for (const axis of result.axes) {
    const meta = AXIS_META[axis.key];
    lines.push(`| ${meta.labelKo} (${meta.label}) | ${axis.score} |`);
  }
  lines.push(`| **종합** | **${result.overallScore}** |`);
  lines.push(``);

  lines.push(`## 4. 5대 축별 상세 분석`);
  lines.push(``);
  for (const axis of result.axes) {
    const meta = AXIS_META[axis.key];
    lines.push(`### ${meta.labelKo} — ${axis.score}점`);
    lines.push(``);
    lines.push(`> ${meta.description}`);
    lines.push(``);
    if (axis.strengths.length) {
      lines.push(`**강점**`);
      for (const s of axis.strengths) lines.push(`- ${s}`);
      lines.push(``);
    }
    if (axis.weaknesses.length) {
      lines.push(`**약점**`);
      for (const s of axis.weaknesses) lines.push(`- ${s}`);
      lines.push(``);
    }
    if (axis.findings.length) {
      lines.push(`**관찰**`);
      for (const s of axis.findings) lines.push(`- ${s}`);
      lines.push(``);
    }
    if (axis.recommendations.length) {
      lines.push(`**개선 제안**`);
      for (const s of axis.recommendations) lines.push(`- ${s}`);
      lines.push(``);
    }
  }

  lines.push(`## 5. Key Insights`);
  lines.push(``);
  for (const insight of result.keyInsights) {
    lines.push(`- ${insight}`);
  }
  lines.push(``);

  lines.push(`## 6. Action Plan & 90일 Roadmap`);
  lines.push(``);
  lines.push(`### Quick Wins (즉시 실행)`);
  lines.push(``);
  for (const win of result.quickWins) {
    lines.push(
      `- **${win.title}** — 임팩트 ${impactLabel(win.impact)} / 노력 ${impactLabel(win.effort)}: ${win.description}`,
    );
  }
  lines.push(``);

  lines.push(`### High-Impact Priorities`);
  lines.push(``);
  for (const p of result.highImpactPriorities) {
    lines.push(`- ${p}`);
  }
  lines.push(``);

  lines.push(`### 30 / 60 / 90일 로드맵`);
  lines.push(``);
  for (const item of result.roadmap) {
    lines.push(`#### ${item.phase}일 — ${item.title}`);
    lines.push(``);
    lines.push(item.description);
    lines.push(``);
    lines.push(`- 기대 성과: ${item.expectedOutcome}`);
    lines.push(``);
  }

  // Naver Search Advisor compliance
  if (result.naverSeo?.markdown) {
    lines.push(result.naverSeo.markdown.trim());
    lines.push(``);
  }

  // Search measure tasks (human-confirmed later on results page)
  lines.push(`## 8.5 검색 실측 (반자동)`);
  lines.push(``);
  lines.push(
    `> **표면 점수 ≠ 검색 실측.** 표면 축은 HTML만 봅니다. 아래 링크를 열어 실제 검색 화면을 확인한 뒤, 결과 화면의 「검색 실측」에서 노출 여부를 기록하세요.`,
  );
  lines.push(``);
  if (result.searchMeasure?.items?.length) {
    const sm = result.searchMeasure;
    if (sm.summary && sm.summary.status !== "미입력") {
      lines.push(
        `**기록된 실측:** 점수 ${sm.summary.score} · ${sm.summary.status} · ${sm.summary.result}`,
      );
      lines.push(``);
    }
    lines.push(`| 항목 | 플랫폼 | 쿼리 | 확인 링크 | 결과 |`);
    lines.push(`| --- | --- | --- | --- | --- |`);
    for (const it of sm.items) {
      lines.push(
        `| ${it.label} | ${it.platform} | \`${it.query.replace(/\|/g, "/")}\` | [열기](${it.url}) | ${it.status} |`,
      );
    }
    lines.push(``);
    lines.push(
      `브랜드 추정: **${sm.brand}** · 서비스 키워드: **${sm.service}** · 호스트: ${sm.hostname}`,
    );
    lines.push(``);
  } else {
    lines.push(`검색 실측 항목이 생성되지 않았습니다. 키워드를 넣고 재진단하세요.`);
    lines.push(``);
  }

  // SEO playbook (before_after.md routine) — concrete examples
  if (result.seoPlaybook?.markdown) {
    lines.push(result.seoPlaybook.markdown.trim());
    lines.push(``);
  } else {
    lines.push(`## 9. SEO 최적화 실행 가이드`);
    lines.push(``);
    lines.push(`(SEO 플레이북이 생성되지 않았습니다. 진단을 다시 실행해 주세요.)`);
    lines.push(``);
  }

  lines.push(`## 10. Methodology`);
  lines.push(``);
  lines.push(result.methodology);
  lines.push(``);
  if (result.crawledPages?.length) {
    lines.push(`크롤된 페이지:`);
    for (const p of result.crawledPages) lines.push(`- ${p}`);
    lines.push(``);
  }

  lines.push(`## 11. Appendix`);
  lines.push(``);
  lines.push(`- 사이트 설명: ${result.siteDescription ?? "(없음)"}`);
  lines.push(
    `- SEO Before→After 루틴: \`before_after.md\` (서브온 ‘서브온 병원동행’ = 회사+메인서비스 검색 연결 사례)`,
  );
  lines.push(
    `- 목표: 회사명 단독 SEO가 아니라 메인 서비스·유관 검색어에서 공식 홈·콘텐츠가 연결되게 하는 신호 정렬`,
  );
  lines.push(`- 본 보고서는 MarkDiag 자동 생성본이며, 전문가 검토·게시 전 검수를 대체하지 않습니다.`);
  lines.push(
    `- 검색 순위·노출은 보장하지 않습니다. 성과는 ‘회사+메인서비스’ 실검색 연결·문의·예약으로 4주 단위 판단하세요.`,
  );
  lines.push(`- PDF/PPT 내보내기 및 광고 플랫폼 연동은 Phase 2에서 제공됩니다.`);
  lines.push(``);
  lines.push(`---`);
  lines.push(`*Generated by MarkDiag · AI Online Marketing Diagnosis*`);

  return lines.join("\n");
}
