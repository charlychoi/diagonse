export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "diagonse",
    mode: "auto-agent-api",
    time: new Date().toISOString(),
  });
}
