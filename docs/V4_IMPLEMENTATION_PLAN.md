# V4 구현 계획 (PRD: 비즈니스 모델 적응형 진단)

기준선: `main@17bca4d`, 테스트 47/47 통과.

## 현행 코드와 PRD 차이 체크리스트

- [ ] (P1) `lib/business-profile-types.ts` — MarketMotion/RevenueMotion/SiteRole/ConversionGoal/BusinessProfile/CustomerJourney/증거 타입 신설
- [ ] (P1) `lib/business-classifier-prompt.ts` — JSON 강제 분류 프롬프트
- [ ] (P1) `lib/business-classifier.ts` — AI 분류 + AI 미사용 시 휴리스틱(B2C 강제 폴백 금지, unknown 허용)
- [ ] (P1) `lib/business-profile-validator.ts` — 스키마·신뢰도(§10.3)·needsConfirmation 검증
- [ ] (P1) `lib/journey-builder.ts` — 모델별 고객 여정 생성 (§7.5 전환 목표 매핑)
- [ ] (P2) `lib/scoring/common-score.ts` — 공통 기반 점수(정체성15/기술15/신뢰10/측정10 → 100 정규화)
- [ ] (P2) `lib/scoring/profile-registry.ts` + `journey-score.ts` — 유형별 체크와 N/A 분모 제외(§11.3), 적용<3개 시 숫자점수 미생성
- [ ] (P3) `lib/analyzer.ts` — 분류를 5축 채점 이전(MUST 단계 3)으로 이동, profile 전파
- [ ] (P3) `lib/conversion-diagnosis.ts` — profile 인자 추가: 비B2C에서 전화·카카오·예약을 not_applicable 처리
- [ ] (P3) `lib/score-reliability.ts` — 비B2C 프로필에서 'CTA·폼 없음 상한 62' 제거
- [ ] (P3) `lib/seo-playbook.ts` — 'B2B = title 희석' 규칙을 B2B/B2G 프로필에서 비활성화
- [ ] (P3) `lib/ai-strategy.ts` — 비용·추천·후기·신청 방법 자동 결합을 B2C 계열로 한정
- [ ] (P3) `lib/diagnosis-consistency.ts` — §20 모순 검사(치명 시 보수 문구 대체)
- [ ] (P3) `lib/report.ts` — v4 첫 페이지 섹션(모델 판별/고객 지도/여정 점수/N-A) 선행 배치
- [ ] (P3) `lib/auto-diagnose.ts` — 응답 `version: "4.0.0"`, `businessProfile`, `adaptiveScores` 추가(기존 필드 유지)
- [ ] (P3) `app/DiagnoseApp.tsx` — 분류 확인 카드 + 여정별 점수 표시
- [ ] (P4) 회귀 테스트 — 상상우리(b2b/b2g)·이커머스·SaaS·AI 비활성 픽스처
- [ ] (P4) `USER_MANUAL.md` v4 갱신, 전체 테스트·빌드

## 이번 릴리스에서 보류(로그에 기록)

- `lib/scoring/profiles/*.ts` 분리 파일 대신 profile-registry 단일 모듈에 등록(모델 7종 지원은 동일)
- `adaptive-competitors` 별도 모듈 대신 기존 comparison에 프로필 항목 주입
- UI 분류 '수정' 액션은 `businessProfileOverride` API 파라미터로 우선 제공(카드 내 편집 UI는 후속)
