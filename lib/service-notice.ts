/**
 * 서비스 공지 배너 — 코드 재배포 없이 Vercel 환경변수만으로 화면 상단에
 * 빨간 경고 메시지를 띄우고 싶을 때 사용한다(예: API 토큰 소진, 점검 안내).
 *
 * SERVICE_NOTICE 환경변수에 문구를 넣으면 활성화되고, 값을 지우면(또는
 * 미설정 시) 배너가 사라진다. AI 자체는 계속 시도하되(폴백이 항상 보장되므로
 * 서비스는 중단되지 않음), 사용자에게 현재 AI 품질이 떨어질 수 있음을
 * 미리 알리는 용도.
 */

export function getServiceNotice(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.SERVICE_NOTICE;
  if (!raw || !raw.trim()) return null;
  return raw.trim();
}
