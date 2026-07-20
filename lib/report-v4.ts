/**
 * v4 보고서 선행 섹션 (PRD §15) — 기존 보고서 상단에 배치되는 Markdown.
 */
import type { AdaptiveDiagnosisScores, BusinessProfile, JourneyScoreCard, ScoreCard } from "./business-profile-types";
import { MARKET_MOTION_LABEL, CONVERSION_GOAL_LABEL, BUYING_CYCLE_LABEL } from "./business-profile-types";
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
  const confidencePct = Math.round(profile.confidence * 100);
  const confidenceKo = profile.confidenceLabel === "high" ? "높음" : profile.confidenceLabel === "medium" ? "중간" : "낮음";
  const sourceKo = profile.source === "ai_web" ? "AI가 실제 웹 검색까지 해서 판단" : profile.source === "user_override" ? "컨설턴트가 직접 지정" : "자동 규칙으로 1차 추정(정확도 제한적)";
  lines.push(`- **판별 확신도:** ${confidenceKo} (${confidencePct}%) · ${sourceKo}`);
  if (profile.needsConfirmation) lines.push(`- ⚠️ **방문 시 꼭 확인하세요:** 자동 분류의 확신도가 낮습니다. 실제 회사 상황과 다르면 컨설턴트가 유형을 다시 지정할 수 있습니다.`);
  if (profile.evidence.length) {
    lines.push("", "**이렇게 판단한 이유**", "");
    profile.evidence.slice(0, 4).forEach((e) => lines.push(`- ${e.claim} — 홈페이지에서 “${e.evidenceText.slice(0, 80)}” 라는 내용을 확인했습니다. (근거 ${e.strength === "strong" ? "확실함" : e.strength === "medium" ? "보통" : "약함"})`));
  }
  if (profile.alternativeHypotheses.length) {
    lines.push("", `**다르게 볼 수도 있는 가능성**`, "");
    profile.alternativeHypotheses.forEach((h) => {
      const sentence = h.reason && h.reason.trim() ? h.reason.trim() : `${MARKET_MOTION_LABEL[h.marketMotion]}에 더 가까운 회사일 수도 있습니다.`;
      lines.push(`- ${sentence} *(참고 유형: ${MARKET_MOTION_LABEL[h.marketMotion]})*`);
    });
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
    const priorityKo = j.priority === "primary" ? "가장 중요한 여정" : j.priority === "secondary" ? "그다음으로 중요한 여정" : "함께 챙길 여정";
    const goalKo = CONVERSION_GOAL_LABEL[j.objective] || j.objective;
    const cycleKo = BUYING_CYCLE_LABEL[j.buyingCycle] || j.buyingCycle;
    lines.push(`- **${j.label}** — ${priorityKo} · 대상: ${MARKET_MOTION_LABEL[j.marketMotion]} 고객`);
    lines.push(`  - 이 사람들이 하길 바라는 행동: **${goalKo}**`);
    lines.push(`  - 결정 속도: ${cycleKo}`);
    if (j.expectedCtas.length) lines.push(`  - 화면에 있어야 할 버튼·문구 예시: ${j.expectedCtas.slice(0, 3).join(", ")}`);
  });

  lines.push("", `## 4. 공통 온라인 기반 — ${fmtScore(scores.coreReadiness)}`, "", cardTable(scores.coreReadiness));

  lines.push("", `## 5. 여정별 전환 준비도`);
  if (scores.provisional) lines.push("", `> ⚠️ 비즈니스 유형 판별 확신도가 낮아 **임시 진단**입니다. 방문 시 유형을 확인하면 점수가 확정됩니다. 지금은 단일 종합 등급을 표시하지 않습니다.`);
  scores.journeyScores.forEach((j: JourneyScoreCard) => {
    if (shouldHideCard(j)) return;
    lines.push("", `### ${j.journeyLabel} — ${fmtScore(j)}`, "", j.narrative, "", cardTable(j));
  });
  if (scores.overallScore !== null) {
    lines.push("", `**종합(참고):** 공통 50% + 주 여정 50% = ${scores.overallScore}점 (${scores.grade})`);
  } else {
    lines.push("", `**종합 등급:** ${scores.provisional ? "분류 확인 후 확정" : "혼합 모델 — 여정별 점수를 각각 참고하세요(단일 종합점수는 보조값)"} `);
  }

  const naItems = [scores.coreReadiness, ...scores.journeyScores].flatMap((c) => c.checks.filter((ch) => ch.status === "not_applicable" || ch.status === "manual").map((ch) => `${ch.title}(${ch.status === "manual" ? "직접 확인 필요" : "이 회사엔 해당 없음"})`));
  if (naItems.length) lines.push("", `**점수에서 뺀 항목(감점 아님):** ${[...new Set(naItems)].join(" · ")}`);
  if (warnings.length) lines.push("", `**진단 시 참고사항:** ${warnings.map((w) => w.message).join(" / ")}`);

  return lines.join("\n");
}
