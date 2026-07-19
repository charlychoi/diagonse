# AI 온라인 마케팅 사전진단

회사 홈페이지 URL과 회사명을 입력하면 홈페이지 표면 신호, 전환 동선, 광고 준비도, 서비스 페이지, 경쟁사 후보를 분석해 보고서를 만듭니다.

공개 사이트: [diagnose.charlychoi.chatgpt.site](https://diagnose.charlychoi.chatgpt.site)

공개 사이트와 GitHub 소스에는 저장소 소유자의 OpenAI·xAI 등 개인 API 키가 없습니다. 공개 사이트는 규칙 기반 진단으로 안전하게 동작하며, 저장소를 복제한 사용자는 자신의 Claude·ChatGPT·Gemini·Grok API 키를 선택해 AI 기능을 켤 수 있습니다.

## 빠른 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다. 아무 키도 넣지 않으면 규칙 기반 결과가 제공됩니다.

## 복제 사용자의 자체 API 연결

`.env.local`에서 하나의 공급자와 그 공급자의 키만 설정합니다.

```text
AI_PROVIDER=anthropic   # 또는 openai, gemini, xai
ANTHROPIC_API_KEY=복제한_사용자의_키
```

대응 변수는 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`입니다. `.env.local`은 Git에서 제외되고 키는 서버에서만 읽으며 브라우저에 전달하지 않습니다.

## Mac 로컬 OAuth 연결

API 키를 파일에 입력하지 않고 로그인된 CLI 구독 계정을 로컬 테스트에만 재사용할 수 있습니다.

### Grok OAuth

```bash
grok login --oauth
```

```text
AI_MODE=local-oauth
AI_PROVIDER=grok
GROK_MODEL=grok-4.5
```

### ChatGPT/Codex OAuth

```bash
codex login
```

```text
AI_MODE=local-oauth
AI_PROVIDER=codex
CODEX_MODEL=gpt-5.6
```

애플리케이션은 CLI 명령을 호출할 뿐 OAuth 토큰이나 로그인 이메일을 읽거나 복사하지 않습니다. 이 방식은 로컬 Mac 전용이며 Sites 같은 공개 호스팅에서는 실행되지 않습니다. Codex는 공식 문서의 [ChatGPT 로그인](https://developers.openai.com/codex/auth/)과 [`codex exec`](https://developers.openai.com/codex/noninteractive/)을, Grok은 공식 [CLI OAuth 로그인](https://docs.x.ai/build/cli/reference)과 [headless 실행](https://docs.x.ai/build/cli/headless-scripting)을 사용합니다.

## 검증

```bash
npm test
npm run build
npm run build:sites
```

자세한 로컬 설정은 [RUN_LOCAL.md](./RUN_LOCAL.md), 진단 기준은 [USER_MANUAL.md](./USER_MANUAL.md)를 참고하세요.
