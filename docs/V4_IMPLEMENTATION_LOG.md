# V4 구현 로그

기준선 main@17bca4d (47/47) → 구현 후 72/72 통과.

## 구현됨 (PRD 대비)

- 분류 후 채점(§9.1 MUST): `classifyBusiness`가 5축 채점·전환·키워드·플레이북보다 먼저 실행
- 다중 라벨 + 구매자/수혜자 분리 + 근거·신뢰도(§10.3) + 저신뢰 임시진단(§8.3)
- N/A 분모 제외·적용<3개 서술형(§11.3), 공통 50%+주여정 50%(§11.4), 혼합형 등급 미확정
- 12개 시장 모델 여정 체크(§11.2), 이커머스 문의폼 미감점, B2B 전화·카카오 N/A
- §19.3 제거 규칙: CTA·폼 62 상한(비B2C 면제), B2B title 희석(비활성), 비용·후기·신청방법 자동 결합(B2B/B2G 교체)
- API v4.0.0: businessProfile/adaptiveScores/businessProfileOverride, 기존 필드 유지(§17.3)
- 보고서 v4 첫 페이지 섹션(§15) + 일관성 검증기(§20, 보수 문구 대체)
- UI: 분류 카드 + 여정별 점수 칩(§16.2 일부)
- 회귀 테스트(§21.2): B2B/B2G 혼합·이커머스·SaaS·AI 비활성 픽스처 (회사명 하드코딩 없음)

## PRD와 다르게 구현/보류한 항목과 사유

1. `lib/scoring/profiles/*.ts` 파일 분리 대신 `profile-registry.ts` 단일 등록 모듈 — 체크 빌더가 짧아 파일 분리가 유지보수에 불리
2. UI 분류 '수정' 버튼(§16.2)은 API `businessProfileOverride`로 우선 제공 — 폼 상태·재요청 UX는 후속 PR
3. `adaptive-competitors` 별도 모듈 보류 — 기존 AI 후보 선정에 프로필 문맥이 반영되며, direct/alternative/benchmark 구분은 후속
4. hero-diagnosis·ad-readiness의 프로필별 세분화는 부분 반영(전환 N/A 경유) — 전용 체크 재작성은 후속
5. build:sites(vinext/wrangler)는 로컬 샌드박스 네트워크 제한으로 미검증 — `next build`만 검증
