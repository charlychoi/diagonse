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

## v4.1 사전진단 극대화 (feature/previsit-maximize)

목적: 이력관리 제외, 방문 전 사전진단의 신뢰성·품질을 AI로 극대화.

- **social_enterprise 프로필 신설**: 분류(휴리스틱 최우선 + AI 프롬프트 규칙), 여정 템플릿(공공·기관 판로), 채점 5+1항목(인증/임팩트/공공구매/기관경로/시장매출 + 지원사업 균형 manual), 전화 N/A, 사회적기업·공공구매·ESG 키워드 의도
- **AI 품질 패스(단일 호출)**: 쉬운 용어 요약 + 방문 전 브리핑 팩(페인포인트·미팅 질문 8~10) + 진단 자기검증(qualityFlags). 실패·미사용 시 규칙 기반 폴백 보장
- **산출물**: briefMarkdown(방문 전 브리핑) / summaryMarkdown(사전진단 요약) — UI에서 .md 다운로드 + 기존 openPrintPdf로 PDF 저장
- **실측 강화**: /robots.txt·/sitemap.xml 실제 fetch — Disallow:/ 전체 차단은 fail(최우선 조치), 확인 실패는 not_observed(감점 없음)
- 테스트 79/79 (v4 72 + v4.1 7)

### 보류(후속)
- PageSpeed Insights API 연동(키 필요), 경쟁사 direct/alternative/benchmark 구분, v3 보고서 완전 강등

## v4.2 진단 UX·보고서 품질 개선 (feature/previsit-maximize 후속)

- **진행률 표시**: 진단 실행 중 단계별 라벨(홈페이지 수집→AI 분류→채점→경쟁사/키워드 AI→AI 심층전략→요약/브리핑 작성)과
  경과 시간·예상 소요 시간(약 1~3분)을 보여주는 클라이언트 진행률 바 추가. 서버가 실제 진행률을 보내지 않으므로
  경과 시간 기반 추정치이며, 응답 도착 시 즉시 100%로 종료.
- **요약/상세 보고서 재구성 (핵심 수정)**: "쉬운 보고서"라는 별도 AI 창작물을 만들던 방식을 폐기.
  파이프라인 순서를 "상세 보고서(markdownReport) 완성 → 그 원문을 AI에게 그대로 제공 → 쉬운 말로 요약"으로
  바꿔 상세 보고서와 요약이 서로 다른 이야기를 하던 핀트 어긋남을 근본적으로 제거. 산출물 이름도
  "사전진단 요약"(구 easyMarkdown)·"사전진단 상세 보고서"(기존 전체 markdownReport, 이름만 명확화)로 정리.
  다운로드 버튼도 상세 보고서 / 요약 / 방문 전 브리핑 3그룹으로 재배치.
- **쉬운 용어화**: v4 보고서의 CustomerJourney.objective·buyingCycle raw enum(예: book_service, short)이
  그대로 노출되던 버그를 CONVERSION_GOAL_LABEL·BUYING_CYCLE_LABEL 한국어 매핑으로 수정.
  "대안 가설: 모델(이유)" 형식을 사람이 읽는 문장 중심으로 재구성하고, 분류 프롬프트에 영어 전문용어
  (primary, hybrid 등) 금지 규칙을 추가. 신뢰도 표기를 소수점(0.20)에서 %로 통일, "신뢰도"→"판별 확신도" 용어 통일.
- **셀프 테스트 강화**: tests/e2e-pipeline.test.ts 신설 — runDiagnosis() 전체를 mocked fetch로 종단 실행해
  raw enum 유출·구 용어("대안 가설:", "쉬운 보고서", "목표 전환:", 소수점 신뢰도) 재발을 회귀 테스트로 고정.
  전체 85/85 테스트 통과, `next build` 통과.

## v4.3 요약/브리핑 그라운딩 강화 + 다운로드 UI 리스트박스화 (feature/previsit-maximize 후속)

사용자 피드백: v4.2 이후에도 사전진단 요약·방문 전 브리핑 내용이 상세 보고서와 일치하지 않는 사례가 남아있음을 확인.

- **그라운딩 근본 수정(lib/previsit-quality.ts)**:
  - `reportExcerpt`: 기존에는 markdownReport 전체(v4 섹션+v3 레거시)를 앞에서부터 9000자로 단순 절단 —
    여정이 많은 보고서는 v4 섹션(여정별 점수 등)의 뒷부분이 잘려 AI가 보지 못하는 경우가 있었음.
    수정 후에는 "# 상세 진단 (참고 — 기존 v3 채점)" 구분선 이전 v4 핵심 섹션(비즈니스 모델 분류·고객 여정·
    공통 기반·여정별 점수)은 **길이에 관계없이 항상 전체 포함**하고, 그 뒤 v3 레거시 섹션만 12000자로 발췌.
  - `anchorFacts`: 기존에는 quickWins·roadmap·aiPrecheck의 제목(title)만 제공해 AI가 근거 문장을 스스로
    지어낼 여지가 있었음. 수정 후에는 실제 취약/주의 체크 전체(제목+근거detail+조치action, 공통기반·여정별
    모두 포함) · quickWins(설명 포함) · roadmap(설명·기대성과 포함) · AI 우선순위(이유·조치 포함) ·
    채널 신호 실측치(전화/카카오/폼 등 개수)를 구조화된 JSON으로 제공.
  - 프롬프트에 "topRisks·expectedPainPoints는 반드시 anchorFacts.failWarnChecks 목록에서만 선택,
    quickWinsPlain은 anchorFacts.quickWins에서만 선택, 근거 문장은 anchorFacts의 detail/reason/description을
    쉬운 말로 옮긴 것이어야 함" 규칙을 명시해 AI가 목록 밖 항목·근거를 지어내는 것을 원천 차단.
  - 회귀 테스트 추가: 여정이 많아 v4 섹션이 9000자를 넘는 가짜 보고서로 "v4 섹션 끝부분이 잘리지 않는지"
    검증, anchorFacts에 detail/action이 실제로 포함되는지 검증.
- **다운로드 UI 리스트박스화(app/DiagnoseApp.tsx)**: 상세 보고서/요약/브리핑 × md/html/pdf 총 9개 버튼을
  3줄로 나열하던 방식을 "문서 선택 드롭다운 + 형식 선택 드롭다운 + 다운로드 버튼 1개"의 단일 컴팩트 UI로
  통합(`.doc-picker`). 위치도 결과 탭("📊 요약·AI전략" 등) 아래에서 **탭 위, summary-box 바로 아래**로 이동해
  탭을 클릭하기 전에 문서를 먼저 선택할 수 있게 함. HTML 내보내기도 요약·브리핑 문서까지 확장.
- 전체 86/86 테스트 통과(신규 1건 추가), `tsc --noEmit` 클린, `next build` 통과.
