# Mac에서 로컬 진단 실행하기

## 1. 설치와 실행

Node.js 22.13 이상과 Git이 필요합니다.

```bash
git clone https://github.com/charlychoi/diagonse.git
cd diagonse
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다. 키나 OAuth를 설정하지 않아도 규칙 기반 진단은 동작합니다.

## 2. 방법 A — 내 API 키 사용

Claude, ChatGPT, Gemini, Grok 중 하나를 골라 `.env.local`에 본인의 키를 넣습니다.

```text
AI_PROVIDER=openai
OPENAI_API_KEY=내_OpenAI_API_키
OPENAI_MODEL=gpt-5.6
```

공급자별 선택값과 키는 다음과 같습니다.

| 서비스 | `AI_PROVIDER` | 키 변수 |
| --- | --- | --- |
| Claude | `anthropic` | `ANTHROPIC_API_KEY` |
| ChatGPT API | `openai` | `OPENAI_API_KEY` |
| Gemini | `gemini` | `GEMINI_API_KEY` |
| Grok API | `xai` | `XAI_API_KEY` |

키는 `.env.local`에만 두며 GitHub에 커밋하지 마세요.

## 3. 방법 B — 이 Mac의 OAuth 로그인 사용

이 방법은 API 키를 프로젝트에 입력하지 않습니다. 공식 CLI가 보관하는 로컬 로그인 세션만 재사용합니다.

### Grok을 선택할 때

```bash
grok login --oauth
grok whoami
```

`.env.local`:

```text
AI_MODE=local-oauth
AI_PROVIDER=grok
GROK_MODEL=grok-4.5
```

### ChatGPT/Codex를 선택할 때

```bash
codex login
codex login status
```

`.env.local`:

```text
AI_MODE=local-oauth
AI_PROVIDER=codex
CODEX_MODEL=gpt-5.6
```

서버를 다시 시작한 뒤 `http://127.0.0.1:3000/api/health?ai=1`에서 실제 연결을 확인할 수 있습니다. OAuth 모드는 로컬에서만 사용하세요. 공개 Sites에는 CLI도 로그인 세션도 없으므로 규칙 기반으로 동작합니다.

## 문제 해결

| 증상 | 확인할 내용 |
| --- | --- |
| 규칙 기반으로만 표시 | `.env.local` 위치와 `AI_MODE`, `AI_PROVIDER`를 확인하고 서버 재시작 |
| `grok CLI가 설치되어 있지 않습니다` | [Grok CLI 안내](https://docs.x.ai/build/overview)에 따라 설치 후 `grok login --oauth` |
| `codex CLI가 설치되어 있지 않습니다` | Codex CLI 설치 후 `codex login` |
| OAuth 오류 | `grok whoami` 또는 `codex login status`로 로그인 상태 확인 |
| 포트 3000 사용 중 | `npm run dev -- -p 3001` |

공식 참고: [Codex 인증](https://developers.openai.com/codex/auth/), [Codex 비대화식 실행](https://developers.openai.com/codex/noninteractive/), [Grok CLI 명령](https://docs.x.ai/build/cli/reference), [Grok headless 실행](https://docs.x.ai/build/cli/headless-scripting).
