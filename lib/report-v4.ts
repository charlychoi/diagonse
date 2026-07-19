/**
 * v4 보고서 선행 섹션 (PRD §15) — 기존 보고서 상단에 배치되는 Markdown.
 */
import type { AdaptiveDiagnosisScores, BusinessProfile, JourneyScoreCard, ScoreCard } from "./business-profile-types";
import { MARKET_MOTION_LABEL } from "./business-profile-types";
import { shouldHideCard } from "./scoring/journey-score";
import type { ConsistencyWarning } from "./diagnosis-consistency";

const STATUS_LABEL: Record<string, string> = {
  pass: "✅ 충족", warn: "⚠️ 보강", fail: "❌ 부족",
  manual: "🧭 직접 확인", not_applicable: "➖ 해당 없음", not_observed: "❔ 확인되지 않음",
};

function fmtScore(card: ScoreCard): string {
  return card.score === null ? "서술형(적용 항목 부족)" : `${card.score}점 (적용 ${card.applicableCount} · 제외 ${card.naCount})`;
}

function cardTable(card: ScoreCard): string {
  const rows = card.checks.map((c) => `| ${c.title} | ${STATUS_LABEL[c.status] || c.status} | ${c.detail} |`);
  return ["| 항목 | 상태 | 내용 |", "| --- | --- | --- |", ...rows].join("\n");
}

export function buildV4Sections(
  profile: BusinessProfile,
  scores: AdaptiveDiagnosisScores,
  warnings: ConsistencyWarning[],
): string {
  const lines: string[] = [];
  const motions = [profile.primaryMarketMotion, ...profile.secondaryMarketMotions];

  lines.push(`## 1. 비즈니스 모델 판별`);
  lines.push("");
  lines.push(`- **주 모델:** ${MARKET_MOTION_LABEL[profile.primaryMarketMotion]}`);
  if (profile.secondaryMarketMotions.length) lines.push(`- **보조 모델:** ${profile.secondaryMarketMotions.map((m) => MARKET_MOTION_LABEL[m]).join(", ")}`);
  lines.push(`- **판별 신뢰도:** ${profile.confidenceLabel === "high" ? "높음" : profile.confidenceLabel === "medium" ? "중간" : "낮음"} (${profile.confidence.toFixed(2)}) · 출처: ${profile.source === "ai_web" ? "AI 웹 분석" : profile.source === "user_override" ? "사용자 지정" : "규칙 기반(제한적)"}`);
  if (profile.needsConfirmation) lines.push(`- ⚠️ **분류 확인 필요:** 신뢰도가 낮거나 자동 분류입니다. 유형이 다르면 \`businessProfileOverride\`로 수정하세요.`);
  if (profile.evidence.length) {
    lines.push("", "**핵심 근거**", "");
    profile.evidence.slice(0, 4).forEach((e) => lines.push(`- ${e.claim} — “${e.evidenceText.slice(0, 80)}” (${e.strength === "strong" ? "강" : e.strength === "medium" ? "중" : "약"})`));
  }
  if (profile.alternativeHypotheses.length) {
    lines.push("", `**대안 가설:** ${profile.alternativeHypotheses.map((h) => `${MARKET_MOTION_LABEL[h.marketMotion]}(${h.reason})`).join(" · ")}`);
  }

  lines.push("", `## 2. 고객·구매자·수혜자 지도`, "");
  if (profile.audiences.length) {
    profile.audiences.forEach((a) => {
      const roles = a.roles.map((r) => ({ economicBuyer: "구매자", decisionMaker: "의사결정자", influencer: "영향자", endUser: "사용자", beneficiary: "수혜자", supplierPartner: "공급 파트너" }[r])).join("·");
      lines.push(`- **${a.label}** (${roles || "역할 미상"}) — 필요: ${a.needs.slice(0, 2).join(", ") || "미상"} / 기대 근거: ${a.expectedProof.slice(0, 2).join(", ") || "미상"}`);
    });
  } else {
    lines.push(`- 자동 분류에서 고객 구조를 세분화하지 못했습니다. ${motions.length > 1 ? "복수 모델이 감지되어 고객 유형별 확인이 필요합니다." : "고객 유형을 직접 확인해 주세요."}`);
  }

  lines.push("", `## 3. 핵심 고객 여정과 전환`, "");
  profile.journeys.forEach((j) => {
    lines.push(`- **${j.label}** (${j.priority === "primary" ? "주 여정" : j.priority === "secondary" ? "보조 여정" : "지원 여정"} · ${MARKET_MOTION_LABEL[j.marketMotion]}) — 목표 전환: ${j.objective} · 구매 주기: ${j.buyingCycle} · 기대 CTA: ${j.expectedCtas.slice(0, 3).join(", ") || "-"}`);
  });

  lines.push("", `## 4. 공통 온라인 기반 — ${fmtScore(scores.coreReadiness)}`, "", cardTable(scores.coreReadiness));

  lines.push("", `## 5. 여정별 전환 준비도`);
  if (scores.provisional) lines.push("", `> ⚠️ 분류 신뢰도가 낮아 **임시 진단**입니다. 비즈니스 유형 확인 후 확정됩니다. 단일 종합 등급은 표시하지 않습니다.`);
  scores.journeyScores.forEach((j: JourneyScoreCard) => {
    if (shouldHideCard(j)) return;
    lines.push("", `### ${j.journeyLabel} — ${fmtScore(j)}`, "", j.narrative, "", cardTable(j));
  });
  if (scores.overallScore !== null) {
    lines.push("", `**종합(참고):** 공통 50% + 주 여정 50% = ${scores.overallScore}점 (${scores.grade})`);
  } else {
    lines.push("", `**종합 등급:** ${scores.provisional ? "분류 확인 후 확정" : "혼합 모델 — 여정별 점수를 각각 참고하세요(단일 종합점수는 보조값)"} `);
  }

  const naItems = [scores.coreReadiness, ...scores.journeyScores].flatMap((c) => c.checks.filter((ch) => ch.status === "not_applicable" || ch.status === "manual").map((ch) => `${ch.title}(${ch.status === "manual" ? "직접 확인" : "해당 없음"})`));
  if (naItems.length) lines.push("", `**적용 제외·직접 확인 항목:** ${[...new Set(naItems)].join(" · ")}`);
  if (warnings.length) lines.push("", `**일관성 검증 메모:** ${warnings.map((w) => w.message).join(" / ")}`);

  return lines.join("\n");
}
