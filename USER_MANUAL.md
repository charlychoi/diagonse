# Diagonse · MarkDiag 사용자 매뉴얼

**마케팅 사전진단 — 생성형 AI 스킬 + 헤드리스 백엔드 + 사람용 웹 UI**

| 항목 | 내용 |
|------|------|
| 문서 버전 | 1.0 |
| 작성 기준일 | 2026-07-17 |
| 스킬 저장소 | https://github.com/charlychoi/diagonse |
| 스킬 백엔드 (Vercel) | **https://diagonse.vercel.app** |
| 스킬 소스 | https://github.com/charlychoi/diagonse/tree/main/skills/diagonse |
| 사람용 UI 앱 | `ai-agent-site` (로컬 / vinext) |

> **주의:** 배포 URL은 `diagonse.vercel.app` 입니다.  
> `diagnose.vercel.app` 는 현재 없습니다. (저장소 철자: **diagonse**)

---

## 목차

1. [제품 한눈에 보기](#1-제품-한눈에-보기)  
2. [전체 아키텍처](#2-전체-아키텍처)  
3. [개발·구축 과정 요약](#3-개발구축-과정-요약)  
4. [점수·개념 이해하기](#4-점수개념-이해하기)  
5. [생성형 AI 스킬 등록·사용](#5-생성형-ai-스킬-등록사용)  
6. [Vercel 백엔드 URL 사용법](#6-vercel-백엔드-url-사용법)  
7. [플랫폼별 예시 (ChatGPT · Claude · Gemini · Grok)](#7-플랫폼별-예시)  
8. [사람용 웹 UI 사용법](#8-사람용-웹-ui-사용법)  
9. [실전 예시: 상상우리 · 서브온](#9-실전-예시-상상우리--서브온)  
10. [산출물 파일 위치](#10-산출물-파일-위치)  
11. [FAQ · 한계 · 보안](#11-faq--한계--보안)  
12. [빠른 참조 카드](#12-빠른-참조-카드)  

---

## 1. 제품 한눈에 보기

### 무엇을 해결하나

기업의 **온라인 마케팅·네이버 브랜드 검색 신호**를 진단합니다.

- HTML에 서비스 키워드가 있어도 **H1·title 정렬이 안 되면**  
  네이버에서 `{회사명}` 검색 시 “무슨 일을 하는 회사인지” 안 보이는 **부작용**이 납니다.  
- 이 도구의 목표는 단순 태그 체크리스트가 아니라  
  **`브랜드 = 핵심 서비스` 신호 정렬** (before_after.md 전략) 입니다.

### 두 가지 사용 모드

| 모드 | 대상 | 입력 | 출력 |
|------|------|------|------|
| **생성형 AI 스킬** | Grok, Claude, ChatGPT, Gemini 등 | 대화로 URL + 회사명 | Markdown 보고서 파일 |
| **사람용 웹 UI** | 마케팅 담당·컨설턴트 | 브라우저 폼 / 6대 마법사 | 화면 결과 + 로컬 이력 |

둘은 **별개 모듈**입니다. AI 스킬은 폼을 요구하지 않습니다.

---

## 2. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  사용자                                                  │
│   · 생성형 AI에게 말걸기  /  · 브라우저 UI 직접 조작      │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
             ▼                            ▼
┌────────────────────────┐    ┌──────────────────────────┐
│  Diagonse 스킬         │    │  MarkDiag 웹 UI          │
│  (SKILL.md)            │    │  ai-agent-site           │
│  Grok/Claude/Cursor…   │    │  /diagnose · /self-check │
└────────────┬───────────┘    └──────────────────────────┘
             │
             │  POST { url, company }
             ▼
┌────────────────────────────────────────────────────────┐
│  스킬 백엔드 (Vercel)                                    │
│  https://diagonse.vercel.app/api/diagnose              │
│  · HTML 크롤 · 표면 점수 · 브랜드 연결 · 네이버 가이드    │
│  · Before→After · Markdown 생성                         │
└────────────────────────────────────────────────────────┘
             │
             ▼
        마케팅_사전진단_{회사}_{날짜}.md
```

| 구성 요소 | 역할 | 위치 |
|-----------|------|------|
| **스킬 소스** | AI 행동 지침 | `skills/diagonse/SKILL.md` |
| **스킬 백엔드** | 실제 진단 실행 | Vercel `diagonse.vercel.app` |
| **진단 엔진** | crawl / score / SEO 플레이북 | `diagonse/lib/*` |
| **사람용 UI** | 폼·6대 실측·검색 실측 패널 | `ai-agent-site` |
| **참조 문서** | before_after, PRD, 네이버 가이드 | 저장소 `docs*`, `before_after.md` |

---

## 3. 개발·구축 과정 요약

아래는 이 프로젝트가 만들어진 **전체 과정**입니다.

### 3.1 기획·소스 결합

1. **Claude 1차 코드** — vinext 기반 `ai-agent-site` 골격  
2. **Grok PRD** — `marketing-diagnosis-prd.md` (MarkDiag SaaS 구상)  
3. **Claude 자가진단 원본** — [online_marketing](https://github.com/charlychoi/online_marketing) (D1~D6 반자동)  
4. **실무 가이드** — `before_after.md` (서브온: 브랜드 검색 신호 정렬)  
5. **네이버 공식 가이드** — [서치어드바이저](https://searchadvisor.naver.com/guide)  

### 3.2 사람용 MVP (ai-agent-site)

- 랜딩 / URL 60초 자동진단 / 결과·대시보드  
- 6대 자가진단 내장 (`/self-check`)  
- 점수 신뢰성: **표면 점수** vs **구조 점수** 분리  
- SEO Before→After, 검색 실측 패널, 네이버 가이드 점검  

### 3.3 점수 편차 교정

| 문제 | 조치 |
|------|------|
| URL 진단 78 vs 6대 50 | 표면 점수 상한·가중·신뢰도 감쇠 |
| “실측 아님” 문구 불명 | 축별 실측 제외/방법 안내 |
| HTML 체크만으로 오해 | 브랜드 검색 전략을 1차 목표로 재정의 |

### 3.4 생성형 AI용 분리 (diagonse)

1. 헤드리스 엔진 + `POST /api/diagnose`  
2. GitHub 푸시: https://github.com/charlychoi/diagonse  
3. Vercel 배포: https://diagonse.vercel.app  
4. **스킬 패키지** `skills/diagonse/SKILL.md` (API “제품”이 아닌 **AI 스킬**로 정의)  

---

## 4. 점수·개념 이해하기

### 4.1 세 가지 점수를 섞지 마세요

| 점수 | 영어/필드 | 보는 것 | 안 보는 것 |
|------|-----------|---------|------------|
| **표면 신호** | `surfaceScore` | HTML title·meta·H1·CTA 등 | 실제 검색 순위 |
| **브랜드–서비스 연결** | `brandServiceBinding` | 브랜드=서비스 묶음 강도 | 유료광고 성과 |
| **네이버 기술 가이드** | `naverGuideScore` | robots, canonical, HTTPS… | 브랜드 정체성 전달 |

**예:** 기술 가이드 90점 + 브랜드 연결 30점  
→ “수집은 되는데, 네이버에 ‘회사명’ 치면 뭐 하는 회사인지 안 보임”

### 4.2 “실측 아님” 뜻

| 표현 | 의미 |
|------|------|
| 검색 실측 아님 | 네이버/구글 **실제 결과 화면**을 자동으로 긁지 않음 |
| 퍼널 실측 아님 | 로그인 장벽·문의 이탈을 직접 걸어보지 않음 |
| 운영 실측 아님 | 최근 30·90일 채널 활동을 모름 |

실측이 필요하면:

- 스킬/보고서의 **네이버 검색 링크**를 사람이 열거나  
- 사람용 UI의 **검색 실측 패널** / **6대 D1·D6** 사용  

### 4.3 before_after 전략 (핵심 목표)

**성공 기준 예시**

1. 네이버 `{회사명}` 검색 → 스니펫에 서비스 정체성 노출  
2. 네이버 `{회사명} {서비스}` 검색 → 공식 홈·콘텐츠 연결  

**실패 전형 (서브온 사례)**

- title에 ‘병원동행’ 있음  
- 그러나 H1 = 인증 배지 → **단어 있음 ≠ 신호 강함**  

---

## 5. 생성형 AI 스킬 등록·사용

### 5.1 스킬이 뭔가

`SKILL.md`는 생성형 AI에게 주는 **표준 작업 절차**입니다.

- 입력: URL + 회사명 (+ 키워드)  
- 동작: 백엔드 호출 또는 로컬 CLI → MD 저장  
- 출력: 보고서 파일 + 짧은 요약  

소스:  
https://github.com/charlychoi/diagonse/tree/main/skills/diagonse

### 5.2 Grok에 등록

```bash
git clone https://github.com/charlychoi/diagonse.git
cp -R diagonse/skills/diagonse ~/.grok/skills/diagonse
```

프로젝트 한정:

```bash
cp -R diagonse/skills/diagonse /path/to/project/.grok/skills/diagonse
```

**사용**

```
/diagonse https://sangsangwoori.com/ 상상우리
```

또는:

```
/diagnose https://sangsangwoori.com/ 상상우리
```

(환경에 따라 슬래시 이름 표기가 다를 수 있음 → 스킬 name: `diagonse`)

### 5.3 Claude Code / Cursor에 등록

```bash
# 프로젝트
cp -R diagonse/skills/diagonse .claude/skills/diagonse

# 사용자 전역
cp -R diagonse/skills/diagonse ~/.claude/skills/diagonse
```

### 5.4 ChatGPT / Gemini (파일 시스템 스킬 폴더가 없을 때)

1. [SKILL.md raw](https://raw.githubusercontent.com/charlychoi/diagonse/main/skills/diagonse/SKILL.md) 내용을  
   - Custom GPT **Instructions**, 또는  
   - Gemini **시스템 지시**, 또는  
   - 대화 첫 메시지로 붙여넣기  
2. 백엔드 호출을 허용하거나, curl 결과를 붙여 넣게 안내  

### 5.5 스킬 실행 우선순위 (SKILL.md 기준)

1. **A.** `POST https://diagonse.vercel.app/api/diagnose` (권장)  
2. **B.** 로컬 `npx tsx scripts/diagnose-cli.ts <url> <company>`  
3. **C.** HTML fetch 후 `references/` 체크리스트로 수동 작성  

---

## 6. Vercel 백엔드 URL 사용법

### 6.1 기본 URL

| 용도 | URL |
|------|-----|
| 랜딩·안내 | https://diagonse.vercel.app |
| Health | https://diagonse.vercel.app/api/health |
| 진단 API | https://diagonse.vercel.app/api/diagnose |
| 스키마 조회 | GET https://diagonse.vercel.app/api/diagnose (파라미터 없이) |

### 6.2 POST — JSON (권장)

```bash
curl -sS -X POST "https://diagonse.vercel.app/api/diagnose" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://sangsangwoori.com/",
    "company": "상상우리",
    "keywords": ["AI 컨설팅", "중장년"],
    "industry": "AI 컨설팅·교육"
  }' -o result.json
```

**필수 필드**

| 필드 | 필수 | 설명 |
|------|------|------|
| `url` | ✅ | 홈페이지 URL |
| `company` | ✅ | 회사명 (별칭: `companyName`, `brand`) |
| `keywords` | | 배열 또는 쉼표 문자열 |
| `industry` | | 업종 |
| `format` | | `json`(기본) 또는 `md` |

**응답 주요 필드**

| 필드 | 설명 |
|------|------|
| `ok` | 성공 여부 |
| `scores.surfaceScore` | 표면 점수 |
| `scores.brandServiceBinding` | 브랜드–서비스 연결 |
| `scores.naverGuideScore` | 네이버 기술 점검 |
| `markdown` | 전체 보고서 (MD 본문) |
| `filename` | 권장 저장 파일명 |
| `beforeAfter` | title/meta/H1 교체안 |
| `brandSearchQueries` | 네이버 실검색 링크 |
| `brandVisibility` | 문제·원인·전략 |

### 6.3 POST — Markdown 파일만

```bash
curl -sS -X POST "https://diagonse.vercel.app/api/diagnose" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://sangsangwoori.com/",
    "company": "상상우리",
    "format": "md"
  }' -o 마케팅_사전진단_상상우리.md
```

### 6.4 GET — 쿼리스트링

```bash
curl -sS -G "https://diagonse.vercel.app/api/diagnose" \
  --data-urlencode "url=https://sangsangwoori.com/" \
  --data-urlencode "company=상상우리" \
  --data-urlencode "keywords=AI 컨설팅,중장년" \
  --data-urlencode "format=md" \
  -o 마케팅_사전진단_상상우리.md
```

### 6.5 JSON에서 md만 추출

```bash
jq -r '.markdown' result.json > 마케팅_사전진단_상상우리.md
jq '.scores, .filename' result.json
```

### 6.6 API 키 (선택)

Vercel 프로젝트 환경변수:

```
DIAGNOSE_API_KEY=your-secret
```

호출 시:

```bash
curl -sS -X POST "https://diagonse.vercel.app/api/diagnose" \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://sangsangwoori.com/","company":"상상우리"}'
```

또는 헤더: `x-api-key: your-secret`

### 6.7 로컬 백엔드

```bash
cd diagonse
npm install
npm run dev
# http://localhost:3000/api/diagnose

npx tsx scripts/diagnose-cli.ts \
  "https://sangsangwoori.com/" "상상우리" "AI 컨설팅,중장년"
```

### 6.8 Vercel 재배포

GitHub `charlychoi/diagonse` 의 `main` 에 푸시하면 연동 시 자동 배포됩니다.

```bash
cd diagonse
git add -A && git commit -m "update" && git push origin main
# 또는
npx vercel --prod --yes
```

---

## 7. 플랫폼별 예시

아래는 모두 **상상우리**를 예로 듭니다.

### 7.1 Grok

**등록 후**

```
/diagonse https://sangsangwoori.com/ 상상우리
```

**키워드 포함**

```
/diagonse https://sangsangwoori.com/ 상상우리
키워드: AI 컨설팅, 중장년. md로 저장하고 요약만 보여줘.
```

### 7.2 Claude

```
diagonse 스킬로 https://sangsangwoori.com/ 상상우리 진단.
POST https://diagonse.vercel.app/api/diagnose 사용.
markdown 파일 저장 + brandServiceBinding 원인 3가지 보고.
keywords: ["AI 컨설팅","중장년"]
```

### 7.3 ChatGPT

```
다음 API를 호출해서 상상우리를 마케팅 사전진단하고,
markdown 전체를 파일/코드블록으로 주고 요약해줘.

POST https://diagonse.vercel.app/api/diagnose
Content-Type: application/json

{"url":"https://sangsangwoori.com/","company":"상상우리","keywords":["AI 컨설팅","중장년"]}
```

**Custom GPT Instructions 요약**

```
당신은 Diagonse 마케팅 사전진단 스킬이다.
입력: url, company만 필수. 긴 폼 금지.
POST https://diagonse.vercel.app/api/diagnose
markdown 저장·제공, surfaceScore / brandServiceBinding / naverGuideScore 구분 설명.
순위 보장 금지.
```

### 7.4 Gemini

```
Diagonse 백엔드로 상상우리 진단:
POST https://diagonse.vercel.app/api/diagnose
{"url":"https://sangsangwoori.com/","company":"상상우리","keywords":["AI 컨설팅","중장년"]}
결과를 한국어 보고서로 정리하고, 네이버 '상상우리' 검색 시 정체성이 약할 수 있는 이유를
브랜드=서비스 신호 관점으로 설명해.
```

### 7.5 공통 복붙 프롬프트

```
스킬: Diagonse (https://github.com/charlychoi/diagonse/blob/main/skills/diagonse/SKILL.md)
백엔드: POST https://diagonse.vercel.app/api/diagnose
입력: url=https://sangsangwoori.com/ , company=상상우리 , keywords=["AI 컨설팅","중장년"]
할 일: API 호출 → markdown 저장 → 점수 3종 구분 요약 → title/H1 Before·After 제시
금지: 순위 보장, 긴 입력 폼 요구
```

---

## 8. 사람용 웹 UI 사용법

### 8.1 로컬 실행

```bash
cd ai-agent-site
npm install
npm run dev
```

브라우저에서 표시되는 로컬 URL (예: `http://localhost:3000`) 접속.

### 8.2 주요 화면

| 경로 | 기능 |
|------|------|
| `/` | 랜딩 · 두 엔진 안내 |
| `/diagnose` | URL 60초 자동진단 입력 |
| `/results/[id]` | 점수 · 검색 실측 · 네이버 가이드 · Before→After |
| `/dashboard` | 브라우저 로컬 진단 이력 |
| `/self-check` | 6대 프레임워크 자가진단 (Claude 원본) |

### 8.3 권장 사람 워크플로

1. `/diagnose` 로 URL 진단 → 표면 점수·브랜드 전략 확인  
2. 결과 화면 **검색 실측**에서 네이버 링크 열어 육안 기록  
3. 필요 시 `/self-check` 로 D1~D6 상세 실측  
4. MD 다운로드로 대행사·내부 공유  

---

## 9. 실전 예시: 상상우리 · 서브온

Grok 세션에서 스킬 + Vercel 백엔드로 실제 실행한 결과 요약입니다.

### 9.1 입력

| 기업 | URL | 키워드 예 |
|------|-----|-----------|
| 상상우리 | https://sangsangwoori.com/ | AI 컨설팅, 중장년, 사회혁신 |
| 서브온 | https://www.theserveon.com/ | 병원동행, 부모님 병원동행, 케어리포트 |

### 9.2 점수

| 지표 | 상상우리 | 서브온 |
|------|----------|--------|
| 표면 신호 | 28 (F) | 47 (D) |
| 브랜드–서비스 연결 | 30 · 위험 | 44 · 약함 |
| 네이버 기술 가이드 | 90 | 79 |

### 9.3 핵심 원인

**상상우리**

- title = `상상우리` 만  
- H1 없음  
- description 미션 문구 + 오타(지혜과) · 서비스 키워드 약함  

**서브온**

- title에 병원동행 존재  
- H1 = `보건복지형 예비사회적기업` (서비스 주제 아님)  
- before_after.md 와 동일한 “단어 있음 · 묶음 약함” 패턴  

### 9.4 Before → After (요약)

**상상우리 title**  
`상상우리` → `상상우리 | AI 컨설팅 전문 서비스 · 중장년 · 상담`

**서브온 H1**  
`보건복지형 예비사회적기업` → `서브온 병원동행 — 필요할 때 전문 인력이 함께합니다`

### 9.5 샘플 호출 (재현)

```bash
# 상상우리
curl -sS -X POST "https://diagonse.vercel.app/api/diagnose" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://sangsangwoori.com/","company":"상상우리","keywords":["AI 컨설팅","중장년"]}' \
  | jq -r .markdown > 진단_상상우리.md

# 서브온
curl -sS -X POST "https://diagonse.vercel.app/api/diagnose" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.theserveon.com/","company":"서브온","keywords":["병원동행"]}' \
  | jq -r .markdown > 진단_서브온.md
```

---

## 10. 산출물 파일 위치

로컬 워크스페이스 예시 (`grok-self`):

```
grok-self/
├── docs/
│   └── Diagonse_사용자_매뉴얼.md    ← 본 문서
├── out/
│   ├── 진단_상상우리.md
│   ├── 진단_서브온.md
│   ├── 진단_비교요약_상상우리_서브온.md
│   └── 마케팅_사전진단_*.md
├── diagonse/                       ← AI 스킬 + Vercel 앱
│   ├── skills/diagonse/SKILL.md
│   ├── app/api/diagnose/
│   └── README.md
├── ai-agent-site/                  ← 사람용 UI
├── before_after.md
└── marketing-diagnosis-prd.md
```

스킬 설치 경로:

```
~/.grok/skills/diagonse/SKILL.md
~/.claude/skills/diagonse/SKILL.md   (선택)
```

---

## 11. FAQ · 한계 · 보안

### FAQ

**Q. UI 진단과 AI 스킬 결과가 다른가요?**  
A. 같은 엔진 계열을 쓰지만, UI는 로컬/vinext, 스킬은 Vercel 헤드리스입니다. 키워드·시점에 따라 소폭 차이 날 수 있습니다. 브랜드 전략 방향은 동일합니다.

**Q. 네이버 순위를 올려 주나요?**  
A. **아니요.** 신호 정렬로 발견·정체성 확률을 높이는 도구입니다. 순위·노출 보장 문구를 쓰지 마세요.

**Q. 6대 자가진단은 어디에 있나요?**  
A. 사람용 UI `ai-agent-site` 의 `/self-check` 입니다. AI 스킬 기본 경로에는 포함되지 않습니다.

**Q. diagnose.vercel.app 가 안 열려요.**  
A. 올바른 주소는 **https://diagonse.vercel.app** 입니다.

### 한계

- 검색 결과 자동 스크래핑 없음 (약관)  
- SPA/이미지 위주 사이트는 본문 텍스트 신호가 과소평가될 수 있음  
- 키워드를 잘못 넣으면 브랜드 연결 진단 방향이 빗나갈 수 있음  

### 보안 권장

- 공개 URL이므로 남용 가능 → `DIAGNOSE_API_KEY` 설정 권장  
- 개인정보·비공개 관리자 URL은 넣지 말 것  
- 보고서 MD에 내부 미공개 수치가 필요하면 게시 전 검수  

---

## 12. 빠른 참조 카드

### 등록 (Grok)

```bash
cp -R diagonse/skills/diagonse ~/.grok/skills/diagonse
```

### 한 줄 진단 (AI)

```
/diagonse https://sangsangwoori.com/ 상상우리
```

### 한 줄 진단 (curl)

```bash
curl -sS -X POST "https://diagonse.vercel.app/api/diagnose" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://sangsangwoori.com/","company":"상상우리","format":"md"}' \
  -o 진단_상상우리.md
```

### 링크 모음

| 이름 | URL |
|------|-----|
| 스킬 백엔드 | https://diagonse.vercel.app |
| API 진단 | https://diagonse.vercel.app/api/diagnose |
| Health | https://diagonse.vercel.app/api/health |
| GitHub | https://github.com/charlychoi/diagonse |
| 스킬 소스 | https://github.com/charlychoi/diagonse/tree/main/skills/diagonse |
| SKILL.md raw | https://raw.githubusercontent.com/charlychoi/diagonse/main/skills/diagonse/SKILL.md |
| 네이버 서치어드바이저 | https://searchadvisor.naver.com/guide |

---

## 부록 A. 보고서 MD에 포함되는 섹션

1. Cover · Executive Summary  
2. 브랜드 검색 목표·문제·부작용·전략  
3. 표면 축 Score Card  
4. 실측 HTML (Before)  
5. 신호 매트릭스  
6. Before → After 문안  
7. 네이버 서치어드바이저 기술 전제  
8. 검색 실측 링크 안내  
9. 체크리스트 · 대행사 지시  
10. Methodology · 한계  

## 부록 B. 용어

| 용어 | 설명 |
|------|------|
| MarkDiag | PRD 상 제품명 · 마케팅 사전진단 |
| Diagonse | AI 스킬 + Vercel 백엔드 저장소 이름 |
| Yeti | 네이버 검색로봇 User-Agent |
| 표면 점수 | HTML 휴리스틱 점수 |
| 구조 점수 | 6대 자가진단(정상/주의/취약) 점수 |
| before_after | 서브온 사례 기반 브랜드 신호 정렬 가이드 |

---

*본 매뉴얼은 grok-self 워크스페이스 구축 과정(PRD · UI MVP · 점수 신뢰성 · 네이버 가이드 · AI 스킬 · Vercel 배포)을 사용자 관점으로 정리한 문서입니다.*
