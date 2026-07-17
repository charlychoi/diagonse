---
name: diagonse
description: >
  마케팅 사전진단 스킬 — 홈페이지 URL과 회사명만으로 온라인 마케팅·네이버 브랜드 검색
  신호를 자동 평가하고 Markdown 보고서를 생성한다. 사용자가 UI 폼을 채우지 않아도 된다.
  Triggers: "마케팅 진단", "사전진단", "홈페이지 평가", "SEO 진단", "브랜드 검색 신호",
  "사이트 진단해줘", "URL 진단", "diagonse", "/diagonse", company homepage audit for AI agents.
metadata:
  short-description: "URL+회사명 → 마케팅 진단 MD 보고서"
argument-hint: "<homepage-url> <company-name> [keywords]"
---

# /diagonse — 생성형 AI 마케팅 사전진단 스킬

**목적:** 사람용 인터랙티브 UI 진단과 별개로, 생성형 AI가 **URL + 회사명**만 받아  
최종 평가를 **Markdown 파일**로 남긴다.

**비즈니스 목표 (before_after.md):**  
HTML 태그 채우기가 아니라, 네이버에서 `{회사명}` / `{회사명} {핵심서비스}` 검색 시  
기업이 안 보이거나 정체성이 약한 **부작용을 줄이는 브랜드=서비스 신호 정렬**.

## 입력

사용자 메시지에서 추출:

| 필드 | 필수 | 설명 |
|------|------|------|
| `url` | ✅ | 홈페이지 URL |
| `company` | ✅ | 회사명 / 브랜드 |
| `keywords` | | 핵심 서비스 키워드 (없으면 회사·업종·홈 카피에서 추론) |
| `industry` | | 업종 (선택) |
| `output_path` | | MD 저장 경로 (기본: `./out/마케팅_사전진단_{회사}_{YYYYMMDD}.md`) |

인자가 `/diagonse https://x.com 회사명` 형태면 그대로 파싱.

## 실행 순서 (반드시 이 순서로)

### Step 1 — 입력 확정

- URL에 `https://` 없으면 붙인다.
- 회사명이 없으면 한 번만 짧게 물어본다. **폼 UI를 만들지 않는다.**

### Step 2 — 진단 실행 (우선순위)

**A. 원격 Diagonse API (기본, 권장)**

```bash
curl -sS -X POST "https://diagonse.vercel.app/api/diagnose" \
  -H "Content-Type: application/json" \
  -d '{"url":"<URL>","company":"<COMPANY>","keywords":["<KW1>","<KW2>"]}'
```

- 응답 JSON의 `markdown` → 파일 저장 (`filename` 필드 사용).
- `scores`, `brandVisibility`, `beforeAfter`로 요약 보고.
- API 실패 시 **B**로 폴백.

**B. 로컬 엔진 (이 저장소 안에서)**

```bash
cd <diagonse-repo>
npm install   # 최초 1회
npx tsx scripts/diagnose-cli.ts "<URL>" "<COMPANY>" "<KW1,KW2>"
```

`out/` 아래 생성된 md 경로를 사용.

**C. 도구만 있는 환경 (API·로컬 모두 불가)**

1. 홈페이지 HTML을 fetch/browse.
2. `references/report-outline.md` 구조로 보고서를 **직접 작성**.
3. `references/brand-signal-playbook.md` 체크리스트로 브랜드=서비스 신호를 평가.
4. title / meta description / H1 / OG / 본문 앞 텍스트 실측값을 표로 적고 Before→After 문안 제시.
5. 네이버 검색 확인 링크를 만든다:  
   `https://m.search.naver.com/search.naver?query={encode(회사명)}`  
   `https://m.search.naver.com/search.naver?query={encode(회사명 + " " + 서비스)}`
6. 순위 보장 문구 금지. 성과는 스니펫 정체성·문의 수로.

### Step 3 — 산출물

1. **Markdown 파일**을 워크스페이스에 저장 (필수).
2. 사용자에게 한국어로 짧게 보고:
   - 표면 점수 / 브랜드–서비스 연결 강도
   - 핵심 원인 3개
   - Before→After title·H1 한 줄씩
   - 다음 액션 3개
   - 저장된 md 경로
3. 상세 표·체크리스트는 md에만 두고 채팅은 요약 위주.

### Step 4 — 해석 규칙 (틀림 금지)

| 점수 | 의미 |
|------|------|
| surfaceScore | HTML 표면 신호. **검색 순위 실측 아님** |
| brandServiceBinding | 브랜드=서비스 연결 강도 (비즈니스 KPI에 가깝) |
| naverGuideScore | 서치어드바이저 **기술 전제** (수집 가능 여부). 높아도 브랜드 검색 성공 보장 안 함 |

- 기술 가이드 통과 ≠ 브랜드 검색 해결.
- 단어가 title에만 있고 H1이 없거나 배지/로고면 **연결 약함** (before_after 전형).

## 금지

- 사용자에게 긴 다단계 웹 폼 입력 요구
- “1위 보장”, “노출 보장”, “서울시가 선택한” 류 카피 제안
- 표면 점수와 6대 구조 점수를 같은 척도로 비교·평균

## 참조 파일

같은 스킬 폴더:

- `references/brand-signal-playbook.md` — 브랜드 검색 전략
- `references/report-outline.md` — MD 목차
- `references/agent-examples.md` — 호출 예시

원격 API (있으면 사용): `https://diagonse.vercel.app/api/diagnose`  
저장소: https://github.com/charlychoi/diagonse
