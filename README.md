# Diagonse — 마케팅 사전진단

> **웹 서비스:** **https://diagonse.vercel.app**  
> (`diagnose.vercel.app` 아님 · 철자 **diagonse**)

회사 **홈페이지 URL**과 **회사명**만 입력하면  
온라인 마케팅·네이버 브랜드 검색 신호 보고서를  
**Markdown · HTML · PDF** 로 받을 수 있는 웹 도구입니다.

- **사용:** https://diagonse.vercel.app  
- **매뉴얼:** https://diagonse.vercel.app/manual  
- **GitHub:** https://github.com/charlychoi/diagonse  

## 일반 사용자 (권장)

1. https://diagonse.vercel.app 접속  
2. 홈페이지 URL + 회사명 입력 (키워드·업종은 선택)  
3. **진단 시작**  
4. **MD / HTML / PDF** 저장  

스킬 등록·API 설정은 필요 없습니다.

## 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

```bash
npm run build && npm start
```

CLI (선택):

```bash
npx tsx scripts/diagnose-cli.ts "https://example.com" "회사명" "키워드1,키워드2"
```

## API (선택 · 개발자용)

웹 UI와 동일한 엔진입니다.

```bash
curl -sS -X POST "https://diagonse.vercel.app/api/diagnose" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://sangsangwoori.com/","company":"상상우리"}'
```

- `GET /api/health` — 상태 확인  
- `GET /api/diagnose` (파라미터 없음) — 스키마 안내  
- 선택: 환경변수 `DIAGNOSE_API_KEY` 설정 시 Bearer / `x-api-key` 필요  

## AI 키워드 전략 (v1.1)

**목표: 회사명 검색이 아니라 '핵심 비즈니스 키워드' 검색에서 노출되게 만드는 것.**

회사명+홈페이지만 입력해도, 크롤한 본문 전체를 분석해 아래를 자동 생성합니다 (보고서 5.5절):

- 메인 비즈니스 정의 + 핵심 서비스 키워드 추론
- **키워드 3층 전략**: 1층 핵심전환 / 2층 상황·니즈형(단기 승부처) / 3층 지역·B2B
- title / meta / H1 After안 (키워드 전략 반영)
- FAQ 8개 + FAQPage JSON-LD (네이버 AI 브리핑·생성형 AI 인용 대비)
- 2층 키워드 매칭 블로그 제목 10개
- 2층 키워드가 「검색 실측」확인 링크에 자동 추가

**두 가지 모드:**

| 모드 | 조건 | 품질 |
|---|---|---|
| AI 모드 | 서버 환경변수 `ANTHROPIC_API_KEY` 설정 (Vercel → Settings → Environment Variables) | Claude가 검색 의도·경쟁 관점까지 반영 (권장) |
| 휴리스틱 모드 | 키 없음 (기본) | 본문 빈출 키워드 마이닝 — 회사명 폴백 없음 |

선택: `ANTHROPIC_MODEL` (기본 `claude-sonnet-5`)

> v1.1 변경: 키워드 미입력 시 회사명을 키워드로 쓰던 폴백을 제거했습니다 — 제품 목표(비브랜드 키워드 노출)와 충돌하기 때문입니다.

## 로컬 SEO · 구글 지도/지식 패널 전략 (v1.2)

기업 신뢰도와 구글 노출을 높이는 **로컬 SEO** 분석을 추가했습니다:

- **구글 비즈니스 프로필(GBP) / 지식 패널** — 회사명 검색 시 우측에 지도·회사정보 패널이 뜨게 하는 단계별 전략
- **NAP(상호·주소·전화) 감지·일관성** — 홈페이지에서 전화·주소를 자동 추출, 채널 간 통일 점검
- **구조화 데이터 심층 분석** — JSON-LD @type 감지(Organization / LocalBusiness / FAQPage 등), 누락 시 **붙여넣기용 JSON-LD 자동 생성**
- **리뷰·영업시간·지도 임베드** 신뢰 신호 점검
- **확인 링크** — 구글/네이버 검색, Rich Results Test, GBP 관리 페이지

결과 화면에 「구글 지도·지식 패널 & 로컬 SEO」 카드로 노출되며, 보고서(MD/HTML/PDF)에도 포함됩니다.

## 구글 맵 실검색 (Places API · v1.3)

로컬 SEO를 **일반 지침이 아니라 실제 구글 조회 결과 기반**으로 진단합니다:

- 서버에 `GOOGLE_PLACES_API_KEY`(Places API — Text Search 활성화) 설정 시, 진단 때 **실제 구글 맵에 이 업체가 등록돼 있는지 조회**하고 이름·주소·전화·별점·리뷰수·영업상태를 실데이터로 가져옵니다.
- 등록 확인 시 → GBP 상태 '양호', 실제 리뷰수 반영, **최적화 중심 전략**(카테고리·리뷰·NAP 일치) 제시
- 미등록 확인 시 → '미흡', **신규 등록 중심 전략** 제시
- 홈페이지 전화 vs 구글 등록 전화 **NAP 불일치 자동 감지**
- 키 미설정 시 → "확인 불가"가 아니라 "자동 조회 미수행(키 설정 시 자동화)"으로 정직하게 안내 + 직접 확인 링크

> 설정: Google Cloud → Places API(New) 활성화 → API 키 발급 → Vercel 환경변수 `GOOGLE_PLACES_API_KEY`. (AI 웹검색/`ANTHROPIC_API_KEY`와 별개)

## 점수 해석

| 점수 | 의미 |
|------|------|
| surfaceScore | HTML 표면 신호 |
| brandServiceBinding | 브랜드=서비스 연결 |
| naverGuideScore | 네이버 기술 가이드 점검 |

실제 검색 순위 측정이 아닙니다.

## 배포

```bash
git push origin main
# 또는
npx vercel --prod --yes
```

## 라이선스

Private / 프로젝트 정책에 따름.
