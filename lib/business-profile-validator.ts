/**
 * v4 분류 JSON 검증·정규화 (PRD §10.2, §10.3)
 */
import type {
  AlternativeHypothesis, AudienceProfile, BusinessProfile,
  ClassificationEvidence, CustomerJourney, MarketMotion,
} from "./business-profile-types";

const MOTIONS = new Set(["b2c_service","b2b_service","b2g","b2b2c","b2g2c","d2c_ecommerce","retail_ecommerce","saas","marketplace","membership_community","media_content","nonprofit_public_interest","hybrid","unknown"]);
const REVENUE = new Set(["instant_purchase","reservation_payment","quote_and_contract","project_contract","public_procurement","subscription","commission","advertising_sponsorship","membership_fee","grant_donation","free_public_program","mixed","unknown"]);
const GOALS = new Set(["buy_now","add_to_cart","book_service","call_or_chat","request_quote","request_proposal","contact_sales","download_company_profile","view_case_study","apply_program","register_jobseeker","register_employer","start_trial","create_account","subscribe_content","partner_inquiry","donate"]);
const ROLES = new Set(["economicBuyer","decisionMaker","influencer","endUser","beneficiary","supplierPartner"]);

function motion(v: unknown): MarketMotion { return MOTIONS.has(String(v)) ? (v as MarketMotion) : "unknown"; }
function strArr(v: unknown): string[] { return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 8) : []; }

export function confidenceLabelOf(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.65) return "medium";
  return "low";
}

/** §10.3 — 근거 강도로 confidence를 상한 보정 */
export function applyEvidenceRules(confidence: number, evidence: ClassificationEvidence[], pagesCrawled: number): number {
  const strong = evidence.filter((e) => e.strength === "strong").length;
  let c = Math.max(0, Math.min(1, confidence));
  if (strong >= 2) return c;
  if (strong === 1 || evidence.length >= 2) return Math.min(c, 0.79);
  if (pagesCrawled <= 1 || evidence.length < 2) return Math.min(c, 0.64);
  return c;
}

export function parseBusinessProfileJson(
  raw: string,
  opts: { source: BusinessProfile["source"]; pagesCrawled: number },
): BusinessProfile | null {
  let data: Record<string, unknown>;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    data = JSON.parse(match[0]) as Record<string, unknown>;
  } catch { return null; }

  const primary = motion(data.primaryMarketMotion);
  const secondary = (Array.isArray(data.secondaryMarketMotions) ? data.secondaryMarketMotions : [])
    .map(motion).filter((m) => m !== "unknown" && m !== primary).slice(0, 4);

  const audiences: AudienceProfile[] = (Array.isArray(data.audiences) ? data.audiences : []).slice(0, 6)
    .map((a, i) => {
      const row = (a || {}) as Record<string, unknown>;
      return {
        id: typeof row.id === "string" ? row.id : `a${i + 1}`,
        label: typeof row.label === "string" ? row.label : `고객 ${i + 1}`,
        roles: strArr(row.roles).filter((r) => ROLES.has(r)) as AudienceProfile["roles"],
        organizationType: typeof row.organizationType === "string" ? row.organizationType : undefined,
        needs: strArr(row.needs),
        expectedProof: strArr(row.expectedProof),
      };
    });

  const journeys: CustomerJourney[] = (Array.isArray(data.journeys) ? data.journeys : []).slice(0, 6)
    .map((j, i) => {
      const row = (j || {}) as Record<string, unknown>;
      const cycle = ["instant","short","long","procurement"].includes(String(row.buyingCycle)) ? row.buyingCycle as CustomerJourney["buyingCycle"] : "unknown";
      return {
        id: typeof row.id === "string" ? row.id : `j${i + 1}`,
        label: typeof row.label === "string" ? row.label : `여정 ${i + 1}`,
        audienceId: typeof row.audienceId === "string" ? row.audienceId : audiences[0]?.id || "a1",
        marketMotion: motion(row.marketMotion) === "unknown" ? primary : motion(row.marketMotion),
        objective: GOALS.has(String(row.objective)) ? row.objective as CustomerJourney["objective"] : "contact_sales",
        priority: ["primary","secondary","supporting"].includes(String(row.priority)) ? row.priority as CustomerJourney["priority"] : (i === 0 ? "primary" : "secondary"),
        buyingCycle: cycle,
        expectedCtas: strArr(row.expectedCtas),
        expectedEvidence: strArr(row.expectedEvidence),
      };
    });

  const evidence: ClassificationEvidence[] = (Array.isArray(data.evidence) ? data.evidence : []).slice(0, 8)
    .map((e) => {
      const row = (e || {}) as Record<string, unknown>;
      return {
        claim: String(row.claim || ""),
        evidenceText: String(row.evidenceText || ""),
        sourceUrl: typeof row.sourceUrl === "string" ? row.sourceUrl : "",
        sourceType: ["homepage","service_page","official_external"].includes(String(row.sourceType)) ? row.sourceType as ClassificationEvidence["sourceType"] : "homepage",
        strength: ["strong","medium","weak"].includes(String(row.strength)) ? row.strength as ClassificationEvidence["strength"] : "weak",
      };
    }).filter((e) => e.claim && e.evidenceText);

  const alternatives: AlternativeHypothesis[] = (Array.isArray(data.alternativeHypotheses) ? data.alternativeHypotheses : []).slice(0, 3)
    .map((h) => {
      const row = (h || {}) as Record<string, unknown>;
      return { marketMotion: motion(row.marketMotion), reason: String(row.reason || "") };
    }).filter((h) => h.marketMotion !== "unknown");

  const rawConfidence = typeof data.confidence === "number" ? data.confidence : 0.5;
  const confidence = applyEvidenceRules(rawConfidence, evidence, opts.pagesCrawled);
  const confidenceLabel = confidenceLabelOf(confidence);

  return {
    version: "1.0",
    primaryMarketMotion: primary,
    secondaryMarketMotions: secondary,
    isHybrid: primary === "hybrid" || secondary.length >= 1,
    revenueMotions: strArr(data.revenueMotions).filter((r) => REVENUE.has(r)) as BusinessProfile["revenueMotions"],
    siteRoles: [],
    audiences,
    journeys,
    primaryObjectiveId: journeys.find((j) => j.priority === "primary")?.id || null,
    confidence,
    confidenceLabel,
    evidence,
    alternativeHypotheses: alternatives,
    source: opts.source,
    needsConfirmation: confidenceLabel === "low" || primary === "unknown",
  };
}
