import { AXIS_META, type DiagnosisResult } from "./types";

import { buildFaqJsonLd } from "./ai-strategy";
import { buildV4Sections } from "./report-v4";
import { formatLocalSeoMarkdown } from "./local-seo";

function impactLabel(v: string): string {
  if (v === "high") return "높음";
  if (v === "medium") return "중간";
  return "낮음";
}

function diagnosticLabel(status: string): string {
  return status === "pass" ? "양호" : status === "warn" ? "주의" : status === "fail" ? "취약" : "확인 필요";
}

/** Build Full Diagnosis Report in Markdown (PRD report template) */
export function buildMarkdownReport(
  result: Omit<DiagnosisResult, "markdownReport"> & { markdownReport?: string },
): string {
  const lines: string[] = [];
  const date = new Date(result.createdAt).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });

  lines.push(`# AI 온라인 마케팅 사전진단 보고서`);
  lines.push(``);
  if (result.businessProfile && result.adaptiveScores) {
    lines.push(buildV4Sections(result.businessProfile, result.adaptiveScores, result.consistencyWarnings || []));
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    lines.push(`# 상세 진단 (참고 — 기존 v3 채점)`);
    lines.push(``);
    if (result.adaptiveScores.provisional) {
      lines.push(`> ⚠️ 아래 v3 단일 점수는 비즈니스 유형 확인 전 참고용입니다. v4 여정별 점수를 우선하세요.`);
      lines.push(``);
    }
  }
  lines.push(`## 1. 진단 개요`);
  lines.push(``);
  lines.push(`| 항목 | 내용 |`);
  lines.push(`|------|------|`);
  lines.push(`| 대상 URL | ${result.input.url} |`);
  lines.push(`| 사이트 타이틀 | ${result.siteTitle ?? "(없음)"} |`);
  lines.push(`| 진단 ID | \`${result.id}\` |`);
  lines.push(`| 생성 시각 | ${date} |`);
  lines.push(
    `| AI 진단 점수(v3 참고) | **${result.overallScore} / 100** (등급 ${result.grade})${result.adaptiveScores?.provisional ? " · 임시 — v4 분류 확인 후 확정" : ""} |`,
  );
  if (result.reliability) {
    const confidenceKo = result.reliability.confidence === "high" ? "높음" : result.reliability.confidence === "medium" ? "중간" : "낮음";
    lines.push(`| 신뢰도 | ${confidenceKo} — ${result.reliability.confidenceReason} |`);
    if (result.reliability.expectedStructureRange) {
      const r = result.reliability.expectedStructureRange;
      lines.push(
        `| 6대 자가진단 시 예상 점수대 | 약 ${r.low}~${r.high}점 (참고용) |`,
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
    `> **참고:** 위 점수는 홈페이지에 실제로 게시된 콘텐츠·구조·메시지를 AI가 분석해 매긴 점수이며, 실제 상담 전환율이나 검색 순위 자체를 측정한 정밀 점수는 아닙니다. ` +
      `직접 문항에 답하며 진행하는 사람 검토 기반 정밀 진단(6대 자가진단)을 받으면 위 표의 예상 점수대와는 다른 결과가 나올 수 있습니다.`,
  );
  lines.push(``);

  lines.push(`## 2. 진단 요약`);
  lines.push(``);
  lines.push(result.executiveSummary);
  lines.push(``);

  lines.push(`## 3. 항목별 점수`);
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

  lines.push(`## 5. 핵심 인사이트`);
  lines.push(``);
  for (const insight of result.keyInsights) {
    lines.push(`- ${insight}`);
  }
  lines.push(``);

  lines.push(`## 5.1 첫 화면 메시지 진단 — ${result.hero.score}/100`);
  lines.push(``);
  lines.push(`> ${result.hero.summary}`);
  lines.push(``);
  lines.push(`- 헤드라인: ${result.hero.headline || "미검출"}`);
  lines.push(`- 보조 설명: ${result.hero.subcopy || "미검출"}`);
  lines.push(`- CTA: ${result.hero.ctas.join(", ") || "미검출"}`);
  lines.push(`- 신뢰 요소: ${result.hero.trustSignals.join(" · ") || "미검출"}`);
  lines.push(``);
  for (const check of result.hero.checks) lines.push(`- **${diagnosticLabel(check.status)} · ${check.title}** — ${check.detail}  \n  조치: ${check.action}`);
  lines.push(``);

  lines.push(`## 5.2 전환 동선 진단 — ${result.conversion.score}/100`);
  lines.push(``);
  lines.push(`> ${result.conversion.summary}`);
  lines.push(``);
  lines.push(`- 전환 경로: 전화 ${result.conversion.paths.tel} · 이메일 ${result.conversion.paths.email} · 카카오 ${result.conversion.paths.kakao} · 네이버 ${result.conversion.paths.naver} · 예약 ${result.conversion.paths.booking} · 폼 ${result.conversion.paths.forms}`);
  for (const check of result.conversion.checks) lines.push(`- **${diagnosticLabel(check.status)} · ${check.title}** — ${check.detail}  \n  조치: ${check.action}`);
  lines.push(``);

  lines.push(`## 5.3 광고 집행 준비도 — ${result.adReadiness.score}/100 (${result.adReadiness.level})`);
  lines.push(``);
  lines.push(`> ${result.adReadiness.summary}`);
  lines.push(``);
  lines.push(`| 상태 | 점검 항목 | 진단 | 우선 조치 |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const check of result.adReadiness.checks) lines.push(`| ${diagnosticLabel(check.status)} | ${check.title} | ${check.detail.replace(/\|/g, "/")} | ${check.action.replace(/\|/g, "/")} |`);
  lines.push(``);

  lines.push(`## 5.4 서비스·상품 페이지 진단`);
  lines.push(``);
  lines.push(`> ${result.servicePages.summary}`);
  lines.push(``);
  if (result.servicePages.pages.length) {
    lines.push(`| 페이지 | H1 | 점수 | 주요 취약 항목 |`);
    lines.push(`| --- | --- | ---: | --- |`);
    for (const page of result.servicePages.pages) {
      const weak = page.checks.filter((c) => c.status !== "pass").slice(0, 3).map((c) => c.title).join(", ") || "없음";
      lines.push(`| [${page.title || page.url}](${page.url}) | ${page.h1 || "미검출"} | ${page.score} | ${weak} |`);
    }
    lines.push(``);
  }
  for (const action of result.servicePages.topActions) lines.push(`- ${action}`);
  lines.push(``);

  lines.push(`## 5.5 AI 심층 전략`);
  lines.push(``);
  if (result.aiPrecheck.enabled) {
    lines.push(`- 실시간 웹 검색 사용: ${result.aiPrecheck.usedWebSearch ? "예" : "아니오"}`);
    lines.push(``);
    lines.push(`> ${result.aiPrecheck.summary}`);
    lines.push(``);
    for (const item of result.aiPrecheck.priorities) {
      lines.push(`- **${item.title}** — ${item.reason}  \n  실행: ${item.action}`);
    }
    if (result.aiPrecheck.messaging) {
      lines.push(``);
      lines.push(`**추천 첫 화면 문구**`);
      lines.push(`- 헤드라인: ${result.aiPrecheck.messaging.headline}`);
      lines.push(`- 보조 설명: ${result.aiPrecheck.messaging.subcopy}`);
      lines.push(`- CTA: ${result.aiPrecheck.messaging.primaryCta}`);
    }
    if (result.aiPrecheck.competitorCandidates.length) {
      lines.push(``);
      lines.push(`**AI 웹 검색 경쟁사 후보**`);
      for (const item of result.aiPrecheck.competitorCandidates) lines.push(`- [${item.name}](${item.url}) — ${item.reason} (확신도 ${item.confidence})`);
    }
  } else {
    lines.push(`> AI 로그인 세션을 사용할 수 없어 규칙 기반 진단만 실행했습니다.${result.aiPrecheck.error ? ` 사유: ${result.aiPrecheck.error}` : ""}`);
  }
  lines.push(``);

  lines.push(`## 5.6 경쟁사 비교`);
  lines.push(``);
  lines.push(`> ${result.competitorComparison.summary}`);
  lines.push(``);
  if (result.competitorComparison.competitors.length) {
    for (const c of result.competitorComparison.competitors) {
      lines.push(c.error ? `- ${c.name || c.url} — ${c.error}` : `- [${c.name || c.title || c.url}](${c.url})`);
    }
    lines.push(``);
  }
  if (result.competitorComparison.enabled && result.competitorComparison.comparison.length) {
    lines.push(`| 비교 항목 | 우리 홈페이지 | 경쟁사 | 해석 |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const row of result.competitorComparison.comparison) lines.push(`| ${row.item} | ${row.ours} | ${row.competitors} | ${row.interpretation} |`);
    lines.push(``);
    lines.push(`> 본 비교는 공개된 홈페이지 정보를 AI가 분석한 기준이며 실제 매출·광고 성과를 의미하지 않습니다.`);
    lines.push(``);
  }

  const ks = result.keywordStrategy;
  if (ks) {
    lines.push(`## 5.7 키워드 전략 — 회사명이 아닌 '핵심 키워드'로 노출되기`);
    lines.push(``);
    lines.push(
      `- 산출 방식: ${ks.source === "ai" ? `AI(${ks.model}) — 크롤 본문 검색의도 분석` : "휴리스틱(본문 빈출 키워드)"}`,
    );
    lines.push(`- 메인 비즈니스(추정): ${ks.mainBusiness}`);
    lines.push(
      `- 핵심 서비스 키워드: **${ks.primaryService}**${ks.regions.length ? ` · 감지 지역: ${ks.regions.join(", ")}` : ""}`,
    );
    lines.push(``);
    lines.push(`| 층 | 키워드 | 검색 의도 |`);
    lines.push(`|---|---|---|`);
    for (const kt of ks.tier1) lines.push(`| 1층 핵심전환 | ${kt.keyword} | ${kt.intent} |`);
    for (const kt of ks.tier2) lines.push(`| 2층 상황·니즈 ★ | ${kt.keyword} | ${kt.intent} |`);
    for (const kt of ks.tier3) lines.push(`| 3층 지역·B2B | ${kt.keyword} | ${kt.intent} |`);
    lines.push(``);
    lines.push(`### 온페이지 After안 (키워드 전략 반영)`);
    lines.push(``);
    lines.push(`- title: \`${ks.titleAfter}\``);
    lines.push(`- meta description: \`${ks.metaAfter}\``);
    lines.push(`- H1: \`${ks.h1After}\``);
    lines.push(``);
    if (ks.faqs.length) {
      lines.push(`### FAQ 초안 — AI 검색·네이버 AI 브리핑 인용 대비`);
      lines.push(``);
      for (const f of ks.faqs) lines.push(`- **Q. ${f.q}**  \n  A. ${f.a}`);
      lines.push(``);
      lines.push(`FAQPage JSON-LD (홈 \`<head>\`에 삽입):`);
      lines.push("\`\`\`json");
      lines.push(buildFaqJsonLd(ks.faqs));
      lines.push("\`\`\`");
      lines.push(``);
    }
    if (ks.blogTitles.length) {
      lines.push(`### 2층 키워드 매칭 블로그 제목 제안`);
      lines.push(``);
      for (const bt of ks.blogTitles) lines.push(`- ${bt}`);
      lines.push(``);
    }
    for (const n of ks.notes) lines.push(`> ${n}`);
    lines.push(``);
  }

  lines.push(`## 6. 실행 계획 & 90일 로드맵`);
  lines.push(``);
  lines.push(`### 즉시 실행 항목`);
  lines.push(``);
  for (const win of result.quickWins) {
    lines.push(
      `- **${win.title}** — 효과 ${impactLabel(win.impact)} / 소요 노력 ${impactLabel(win.effort)}: ${win.description}`,
    );
  }
  lines.push(``);

  lines.push(`### 우선순위 높은 개선 과제`);
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

  // Google Business Profile / Local SEO strategy
  if (result.localSeo) {
    lines.push(formatLocalSeoMarkdown(result.localSeo).trim());
    lines.push(``);
  }

  // Search measure tasks (human-confirmed later on results page)
  lines.push(`## 8.5 검색 실측 (반자동)`);
  lines.push(``);
  lines.push(
    `> **AI 진단 점수 ≠ 실제 검색 결과.** 위 점수는 홈페이지에 게시된 정보를 AI가 분석한 것이라 실제 검색 노출과 다를 수 있습니다. 아래 링크를 열어 실제 검색 화면을 직접 확인한 뒤, 결과 화면의 「검색 실측」에서 노출 여부를 기록하세요.`,
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

  lines.push(`## 10. 진단 방법론`);
  lines.push(``);
  lines.push(result.methodology);
  lines.push(``);
  if (result.crawledPages?.length) {
    lines.push(`분석한 페이지:`);
    for (const p of result.crawledPages) lines.push(`- ${p}`);
    lines.push(``);
  }

  lines.push(`## 11. 부록`);
  lines.push(``);
  lines.push(`- 사이트 설명: ${result.siteDescription ?? "(없음)"}`);
  lines.push(
    `- SEO 개선 방식: 회사명+핵심 서비스 검색어로 공식 홈페이지가 연결되도록 정리하는 것을 예시로 삼습니다(예: 서브온 → '서브온 병원동행').`,
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
  lines.push(`*Generated by Diagonse · AI Online Marketing Precheck*`);

  return lines.join("\n");
}
