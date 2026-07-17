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
