/**
 * 임시(체험) 배포 만료 가드.
 *
 * 특정 기간(예: 5일)만 서비스를 운영하고 싶을 때 사용한다.
 * Vercel 환경변수 DEPLOY_EXPIRES_AT(ISO 8601, 예: "2026-07-25T23:59:59+09:00")를
 * 설정하면 그 시각 이후 진단 API 호출을 차단하고 만료 안내를 보여준다.
 * 값이 없으면 기존과 동일하게 무제한으로 동작한다(로컬 개발·영구 배포에 영향 없음).
 */

export function getExpiryDate(env: Record<string, string | undefined> = process.env): Date | null {
  const raw = env.DEPLOY_EXPIRES_AT;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isDeploymentExpired(
  env: Record<string, string | undefined> = process.env,
  now: Date = new Date(),
): boolean {
  const exp = getExpiryDate(env);
  if (!exp) return false;
  return now.getTime() >= exp.getTime();
}

export function expiryDateLabel(env: Record<string, string | undefined> = process.env): string | null {
  const exp = getExpiryDate(env);
  if (!exp) return null;
  return exp.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "short" });
}

export function expiryMessage(env: Record<string, string | undefined> = process.env): string {
  const label = expiryDateLabel(env);
  return label
    ? `이 체험 배포는 ${label} 이후 종료되었습니다. 계속 사용하시려면 담당 컨설턴트(찰리초이)에게 문의해 주세요.`
    : "이 체험 배포는 현재 종료되었습니다. 계속 사용하시려면 담당 컨설턴트(찰리초이)에게 문의해 주세요.";
}
