# AI 온라인 마케팅 사전진단

회사 홈페이지 URL과 회사명을 입력하면 홈페이지 표면 신호를 분석하고, Grok 4.5 API가 실시간 웹 검색으로 경쟁사를 자동 선정해 개선 전략을 생성합니다.

공개 사이트: [diagnose.charlychoi.chatgpt.site](https://diagnose.charlychoi.chatgpt.site)

GitHub를 복제해 실행할 때는 각 사용자가 자신의 xAI API 키를 설정합니다. API 키는 저장소에 포함되지 않습니다.

## 로컬 실행 준비

```bash
npm install
cp .env.example .env.local
```

`.env.local`에 xAI API 키를 설정합니다.

```text
XAI_API_KEY=xai-...
XAI_MODEL=grok-4.5
```

`.env.local`은 Git에서 제외되며 브라우저로 전달되지 않습니다. 저장소를 복제한 사용자는 반드시 자신의 키를 사용해야 합니다.

## 실행

```bash
npm run dev
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다.

## AI 진단

- 모델: `grok-4.5`
- API: xAI Responses API
- 도구: 실시간 `web_search`
- 경쟁사를 입력하지 않으면 공식 HTTPS 홈페이지를 최대 3개 자동 선정
- 선정한 홈페이지를 다시 수집해 CTA, 문의 폼, 콘텐츠 허브, 구조화 데이터, 본문 분량 비교
- AI 호출이 실패해도 기본 홈페이지 진단은 계속하고 오류 사유를 보고서에 표시

기본 진단은 AI 전략과 경쟁사 검색을 한 호출로 처리합니다. 세부 3층 키워드까지 별도 AI 호출로 생성하려면 `.env.local`에 `XAI_KEYWORD_STRATEGY=true`를 설정합니다.

## API

```bash
curl -sS -X POST "http://127.0.0.1:3000/api/diagnose" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","company":"회사명","industry":"업종"}'
```

## 검증

```bash
npm test
npm run build
```

호스팅 환경에서도 `XAI_API_KEY`는 소스가 아닌 비밀 환경 변수로 설정해야 합니다.
