import {
  runAutoDiagnose,
  validateAutoRequest,
  type AutoDiagnoseError,
} from "../../../lib/auto-diagnose";

export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

/**
 * Generative-AI friendly marketing diagnosis API.
 *
 * POST /api/diagnose
 *   Body: { "url": "https://example.com", "company": "회사명", "keywords"?: "...", "industry"?: "..." }
 *
 * GET /api/diagnose?url=...&company=...&format=json|md
 *   Same params as query string. format=md returns raw Markdown.
 *
 * Optional: Authorization: Bearer <DIAGNOSE_API_KEY> if env is set.
 */

function checkApiKey(request: Request): AutoDiagnoseError | null {
  const required = process.env.DIAGNOSE_API_KEY;
  if (!required) return null;
  const auth = request.headers.get("authorization") || "";
  const key =
    auth.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-api-key") ||
    "";
  if (key !== required) {
    return {
      ok: false,
      error: "Unauthorized. Provide Authorization: Bearer <DIAGNOSE_API_KEY> or x-api-key header.",
      code: "VALIDATION",
    };
  }
  return null;
}

function parseQuery(url: URL) {
  return {
    url: url.searchParams.get("url") || "",
    company:
      url.searchParams.get("company") ||
      url.searchParams.get("companyName") ||
      url.searchParams.get("brand") ||
      "",
    keywords: url.searchParams.get("keywords") || undefined,
    industry: url.searchParams.get("industry") || undefined,
    targetCountry: url.searchParams.get("targetCountry") || undefined,
    format: (url.searchParams.get("format") || "json").toLowerCase(),
  };
}

export async function GET(request: Request) {
  const authErr = checkApiKey(request);
  if (authErr) {
    return Response.json(authErr, { status: 401 });
  }

  const u = new URL(request.url);
  // Health / schema discovery for agents
  if (u.searchParams.get("help") === "1" || u.pathname.endsWith("/help")) {
    return Response.json(apiHelp());
  }

  const q = parseQuery(u);
  const validated = validateAutoRequest(q);
  if (!validated.ok) {
    // No params → return API help for agent discovery
    if (!q.url && !q.company) {
      return Response.json(apiHelp());
    }
    return Response.json(
      { ok: false, error: validated.error, code: "VALIDATION" } satisfies AutoDiagnoseError,
      { status: 400 },
    );
  }

  try {
    const result = await runAutoDiagnose(validated.data);
    if (q.format === "md" || q.format === "markdown") {
      return new Response(result.markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "X-Diagonse-Result-Id": result.resultId,
          "X-Diagonse-Surface-Score": String(result.scores.surfaceScore),
        },
      });
    }
    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Diagnosis failed";
    return Response.json(
      { ok: false, error: message, code: "DIAGNOSIS" } satisfies AutoDiagnoseError,
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authErr = checkApiKey(request);
  if (authErr) {
    return Response.json(authErr, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Invalid JSON body. Expected { url, company }",
        code: "VALIDATION",
      } satisfies AutoDiagnoseError,
      { status: 400 },
    );
  }

  const validated = validateAutoRequest(body);
  if (!validated.ok) {
    return Response.json(
      { ok: false, error: validated.error, code: "VALIDATION" } satisfies AutoDiagnoseError,
      { status: 400 },
    );
  }

  const format =
    typeof (body as { format?: string }).format === "string"
      ? (body as { format: string }).format.toLowerCase()
      : "json";

  try {
    const result = await runAutoDiagnose(validated.data);
    if (format === "md" || format === "markdown") {
      return new Response(result.markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "X-Diagonse-Result-Id": result.resultId,
        },
      });
    }
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Diagnosis failed";
    return Response.json(
      { ok: false, error: message, code: "DIAGNOSIS" } satisfies AutoDiagnoseError,
      { status: 500 },
    );
  }
}

function apiHelp() {
  return {
    name: "Diagonse — Marketing Diagnosis API",
    version: "2.1.0",
    description:
      "URL + company name → marketing diagnosis (JSON with markdown). Primary UX is the web UI at /.",
    web_ui: "https://diagnose.charlychoi.chatgpt.site",
    manual: "https://diagnose.charlychoi.chatgpt.site/manual",
    endpoints: {
      "GET /api/diagnose":
        "?url=https://example.com&company=회사명&keywords=키워드1,키워드2&format=json|md",
      "POST /api/diagnose": {
        body: {
          url: "https://example.com",
          company: "회사명",
          keywords: ["키워드1", "키워드2"],
          industry: "업종(선택)",
          channels: ["naver", "instagram", "google_ads"],
          competitors: ["https://competitor1.com", "https://competitor2.com"],
          format: "json | md",
        },
      },
      "GET /api/health": "Health check",
    },
    notes: [
      "Prefer the web UI at / for end users (MD / HTML / PDF download).",
      "Set DIAGNOSE_API_KEY env to require Bearer token.",
      "Local clones use npm run dev and open the web UI on 127.0.0.1.",
      "Set your own XAI_API_KEY in .env.local; hosted deployments use a secret environment variable.",
      "Response includes aiPrecheck, hero, conversion, adReadiness, servicePages, and competitorComparison.",
      "Scores: surfaceScore (HTML), brandServiceBinding (brand search signal), naverGuideScore (technical).",
    ],
  };
}
