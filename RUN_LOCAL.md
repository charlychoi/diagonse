# 로컬 컴퓨터에서 라이브 데모 실행하기

내 컴퓨터에서 실제 AI 진단(크롤 + 경쟁사 웹검색 + 구글 패널 확인)을 그대로 돌려볼 수 있습니다.

## 1. 준비물

- **Node.js 22.13 이상** — 터미널에서 `node -v` 로 확인. 없으면 https://nodejs.org 에서 LTS 설치.
- **Git** — `git --version`
- **AI API 키** (아래 둘 중 하나)
  - 공개 방식(권장): **Anthropic Claude** 키 — https://console.anthropic.com → API Keys
  - 내부 테스트 방식: **xAI Grok** 키 — https://console.x.ai

## 2. 내려받기 & 설치

```bash
git clone https://github.com/charlychoi/diagonse.git
cd diagonse
npm install
```

## 3. `.env.local` 만들기

`diagonse` 폴더 안에 **`.env.local`** 파일을 새로 만들고, 아래 중 하나를 넣습니다.

### 방법 A — 공개 방식(Claude, 권장)

```
ANTHROPIC_API_KEY=sk-ant-여기에_본인_키
ANTHROPIC_MODEL=claude-sonnet-4-5
```

> 모델명은 본인 계정에서 쓸 수 있는 값으로. 오류가 나면 `claude-3-5-sonnet-latest` 로 바꿔보세요.

### 방법 B — 내부 테스트 방식(Grok 4.5)

```
AI_MODE=internal
XAI_API_KEY=xai-여기에_본인_키
XAI_MODEL=grok-4.5
```

> `AI_MODE=internal` 이 있어야 Grok이 동작합니다. 없으면 공개 방식(Claude)로 처리됩니다.

키를 아무것도 넣지 않아도 앱은 실행되지만, AI 없이 규칙 기반 결과만 나옵니다.

## 4. 실행

```bash
npm run dev
```

터미널에 `Ready` 와 `http://127.0.0.1:3000` 이 뜨면, 브라우저에서 **http://127.0.0.1:3000** 접속.

## 5. 데모 테스트 (서브온)

화면에서:
- 홈페이지 URL: `https://theserveon.com`
- 회사명: `서브온`
- (선택) 핵심 키워드: `병원동행`

→ **진단 시작**. 20~60초 후 AI 종합 진단, 경쟁사 비교, 구글 지도·지식 패널 실검색 결과가 나옵니다.

## 자주 겪는 문제

| 증상 | 해결 |
|---|---|
| `node: command not found` | Node.js 미설치 → nodejs.org에서 설치 후 터미널 재시작 |
| AI 결과가 "규칙 기반" 으로만 나옴 | `.env.local` 키 확인, 파일이 `diagonse` 폴더 루트에 있는지 확인, `npm run dev` 재시작 |
| Claude 모델 오류 | `ANTHROPIC_MODEL` 을 `claude-3-5-sonnet-latest` 로 변경 |
| 포트 3000 사용 중 | `npm run dev -- -p 3001` 로 다른 포트 사용 |
| 크롤 실패/빈 결과 | 대상 사이트가 자바스크립트 렌더링이면 본문 수집이 적을 수 있음(정상). 키워드를 직접 입력하면 정확도↑ |

## 참고

- `.env.local` 은 `.gitignore` 에 있어 깃에 올라가지 않습니다(키 안전).
- 종료: 터미널에서 `Ctrl + C`.
