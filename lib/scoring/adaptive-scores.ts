/**
 * v4 종합 점수 조립 (PRD §8.3, §11.4)
 */
import type { ParsedSiteSignals } from "../crawl";
import type { AdaptiveDiagnosisScores, BusinessProfile } from "../business-profile-types";
import { computeCoreReadiness } from "./common-score";
import { scoreJourney, scoringProfileId } from "./profile-registry";

function gradeOf(score: number): "A" | "B" | "C" | "D" | "F" {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
}

export function computeAdaptiveScores(signals: ParsedSiteSignals, profile: BusinessProfile): AdaptiveDiagnosisScores {
  const coreReadiness = computeCoreReadiness(signals);
  const journeyScores = profile.journeys.map((j) => scoreJourney(signals, j));
  const primaryCard = journeyScores.find((j) => j.priority === "primary") || journeyScores[0] || null;
  const primaryJourneyScore = primaryCard?.score ?? null;

  const lowConfidence = profile.confidence < 0.65 || profile.needsConfirmation;
  const singlePrimary = !profile.isHybrid && primaryJourneyScore !== null && coreReadiness.score !== null;

  // §11.4: 고신뢰 단일 주 여정 → 공통 50% + 주 여정 50%. 혼합·저신뢰 → 종합점수 확정 금지.
  const overallScore = !lowConfidence && singlePrimary
    ? Math.round((coreReadiness.score! + primaryJourneyScore!) / 2)
    : null;
  const grade = overallScore !== null ? gradeOf(overallScore) : null;

  return {
    coreReadiness,
    journeyScores,
    primaryJourneyScore,
    overallScore,
    grade,
    provisional: lowConfidence,
    confidence: profile.confidence,
    scoringProfileId: scoringProfileId(profile.primaryMarketMotion, profile.secondaryMarketMotions),
  };
}
