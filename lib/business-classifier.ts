/**
 * v4 비즈니스 모델 분류기 (PRD §10, §18)
 * — 채점 이전(MUST 단계 3)에 실행된다.
 * — AI 사용 시 JSON 분류, 실패·미사용 시 휴리스틱. B2C 강제 폴백 금지.
 */
import { aiEnabled, callAi } from "./ai-provider";
import type { ParsedSiteSignals } from "./crawl";
import type { DiagnosisInput } from "./types";
import type { BusinessProfile, BusinessProfileOverride, MarketMotion } from "./business-profile-types";
import { buildClassifierPrompt } from "./business-classifier-prompt";
import { applyEvidenceRules, confidenceLabelOf, parseBusinessProfileJson } from "./business-profile-validator";
import { buildJourneys } from "./journey-builder";

type AiCallFn = typeof callAi;

/** 휴리스틱 신호 → 다중 라벨 (§18.2). 근거 없으면 unknown. */
export function classifyHeuristically(signals: ParsedSiteSignals, input: DiagnosisInput): BusinessProfile {
  const text = [signals.title, signals.description, ...signals.h1s, ...signals.h2s, (signals.bodyText || "").slice(0, 6000), input.industry || ""].join(" ").toLowerCase();
  const has = (re: RegExp) => re.test(text);
  const hits: { motion: MarketMotion; claim: string; re: RegExp; strength: "strong" | "medium" }[] = [
    { motion: "retail_ecommerce", claim: "장바구니·결제·배송 신호", re: /장바구니|결제|배송|교환.?환불|무료배송|상품평|구매하기|cart|checkout/, strength: "strong" },
    { motion: "saas", claim: "구독·무료체험·데모 신호", re: /무료\s?체험|데모\s?신청|월\s?구독|요금제|api\s?연동|saas|온보딩/, strength: "strong" },
    { motion: "b2g", claim: "공공·용역·위탁 신호", re: /공공기관|지자체|정부|위탁|용역|정책\s?사업|발주|조달|입찰/, strength: "strong" },
    { motion: "b2b_service", claim: "기업 고객·사례·제안 신호", re: /기업\s?교육|고객사|도입\s?사례|제안\s?요청|컨설팅|파트너십|기업\s?대상|임직원/, strength: "medium" },
    { motion: "b2g2c", claim: "공공 프로그램 참여자 신호", re: /모집|참여\s?신청|프로그램\s?신청|교육생|수혜|지원\s?사업/, strength: "medium" },
    { motion: "b2c_service", claim: "예약·상담·후기 신호", re: /예약|후기|시술|상담\s?신청|병원|학원|레슨|출장|동행/, strength: "medium" },
    { motion: "nonprofit_public_interest", claim: "후원·기부·재단 신호", re: /후원|기부|재단|비영리|사회공헌|공익/, strength: "medium" },
    { motion: "marketplace", claim: "양면 플랫폼 신호", re: /파트너\s?등록|입점|공급자|수요자|매칭|중개/, strength: "medium" },
    { motion: "media_content", claim: "콘텐츠·구독 신호", re: /뉴스레터|아티클|매거진|콘텐츠\s?구독/, strength: "medium" },
  ];
  const matched = hits.filter((h) => has(h.re));
  const evidence = matched.map((h) => ({
    claim: h.claim,
    evidenceText: `홈페이지 텍스트에서 관련 키워드 감지 (${h.re.source.split("|").slice(0, 3).join(", ")} …)`,
    sourceUrl: signals.url,
    sourceType: "homepage" as const,
    strength: h.strength,
  }));
  const primary = matched[0]?.motion ?? "unknown";
  const secondary = [...new Set(matched.slice(1).map((h) => h.motion))].filter((m) => m !== primary).slice(0, 3);
  // 휴리스틱은 기본 low(§18.2). 강한 신호 2개 이상일 때만 medium까지 허용.
  const strongCount = matched.filter((m) => m.strength === "strong").length;
  const confidence = primary === "unknown" ? 0.2 : Math.min(strongCount >= 2 ? 0.7 : 0.55, applyEvidenceRules(0.7, evidence, signals.pageCountCrawled ?? 1));
  const profile: BusinessProfile = {
    version: "1.0",
    primaryMarketMotion: primary,
    secondaryMarketMotions: secondary,
    isHybrid: secondary.length >= 1,
    revenueMotions: [],
    siteRoles: [],
    audiences: [],
    journeys: [],
    primaryObjectiveId: null,
    confidence,
    confidenceLabel: confidenceLabelOf(confidence),
    evidence,
    alternativeHypotheses: secondary.map((m) => ({ marketMotion: m, reason: "보조 신호 감지" })),
    source: "heuristic",
    needsConfirmation: true, // 휴리스틱 분류는 항상 사용자 확인 안내
  };
  profile.journeys = buildJourneys(profile);
  profile.primaryObjectiveId = profile.journeys.find((j) => j.priority === "primary")?.id || null;
  return profile;
}

export function applyOverride(profile: BusinessProfile, override?: BusinessProfileOverride | null): BusinessProfile {
  if (!override?.primaryMarketMotion) return profile;
  const next: BusinessProfile = {
    ...profile,
    primaryMarketMotion: override.primaryMarketMotion,
    secondaryMarketMotions: override.secondaryMarketMotions ?? profile.secondaryMarketMotions,
    source: "user_override",
    confidence: Math.max(profile.confidence, 0.9),
    confidenceLabel: "high",
    needsConfirmation: false,
    journeys: [],
  };
  next.isHybrid = next.secondaryMarketMotions.length >= 1;
  next.journeys = buildJourneys(next);
  next.primaryObjectiveId = next.journeys.find((j) => j.priority === "primary")?.id || null;
  return next;
}

export async function classifyBusiness(
  signals: ParsedSiteSignals,
  input: DiagnosisInput,
  options: { override?: BusinessProfileOverride | null; aiCall?: AiCallFn; aiAvailable?: boolean; timeoutMs?: number } = {},
): Promise<BusinessProfile> {
  const available = options.aiAvailable ?? aiEnabled();
  let profile: BusinessProfile | null = null;
  if (available) {
    try {
      const call = options.aiCall || callAi;
      const raw = await call(buildClassifierPrompt(signals, input), { webSearch: true, timeoutMs: options.timeoutMs ?? 75_000 });
      profile = parseBusinessProfileJson(raw.output, { source: "ai_web", pagesCrawled: signals.pageCountCrawled ?? 1 });
      if (profile) {
        profile.journeys = buildJourneys(profile);
        profile.primaryObjectiveId = profile.journeys.find((j) => j.priority === "primary")?.id || profile.primaryObjectiveId;
      }
    } catch { profile = null; }
  }
  if (!profile) profile = classifyHeuristically(signals, input);
  return applyOverride(profile, options.override);
}
