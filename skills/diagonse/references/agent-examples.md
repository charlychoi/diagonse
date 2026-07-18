# 에이전트 사용 예시

## 사용자 말

```
/diagonse https://sangsangwoori.com/ 상상우리
```

```
상상우리 홈페이지 https://sangsangwoori.com/ 마케팅 사전진단해서 md로 남겨줘
```

```
URL이랑 회사명만 줄 테니 브랜드 검색 신호 평가해줘. https://www.theserveon.com/ 서브온 키워드 병원동행
```

## API 호출 (스킬 Step 2-A)

```bash
curl -sS -X POST "http://127.0.0.1:3000/api/diagnose" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://sangsangwoori.com/","company":"상상우리","keywords":["AI 컨설팅","중장년"]}' \
  -o /tmp/diag.json

# markdown 추출 후 저장 (jq)
jq -r .markdown /tmp/diag.json > "./out/$(jq -r .filename /tmp/diag.json)"
```

## 로컬 CLI (스킬 Step 2-B)

```bash
npx tsx scripts/diagnose-cli.ts "https://sangsangwoori.com/" "상상우리" "AI 컨설팅,중장년"
```

## 보고 톤

1. 점수 3종을 나눠 말하기 (표면 / 브랜드연결 / 기술가이드)
2. “안 보이는 이유”를 원인 언어로
3. title·H1 After 한 줄씩
4. md 경로
