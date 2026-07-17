# Diagonse — 생성형 AI 스킬 (마케팅 사전진단)

> **URL 주의:** 올바른 주소는 **https://diagonse.vercel.app** 입니다. `https://diagnose.vercel.app` 는 다른 프로젝트에 할당되어 있거나 SSO로 막혀 **404/로그인 페이지**가 나옵니다. 반드시 **diagon**se** (e 포함 철자)를 사용하세요.

> **이건 REST “제품 API 서버”가 아니라, 생성형 AI가 불러 쓰는 스킬입니다.**  
> 사람용 다단계 입력 UI와 분리되어 있습니다. AI에게 **홈페이지 URL + 회사명**만 주면 Markdown 평가 보고서를 만듭니다.

- **Skill:** [`skills/diagonse/SKILL.md`](./skills/diagonse/SKILL.md)
- **Slash:** `/diagonse <url> <company>`
- **GitHub:** https://github.com/charlychoi/diagonse  
- **실행 백엔드(스킬이 호출):** https://diagonse.vercel.app/api/diagnose  

## 생성형 AI에게 시키는 법

```
/diagonse https://sangsangwoori.com/ 상상우리
```

또는:

```
https://sangsangwoori.com/ 회사명 상상우리 마케팅 사전진단해서 md 파일로 저장해줘
```

스킬이 로드되면 에이전트는:

1. URL·회사명 파싱  
2. Diagonse 엔드포인트(또는 로컬 CLI)로 헤드리스 진단  
3. `markdown`을 `.md`로 저장  
4. 점수·브랜드연결·Before/After 요약 보고  

## 설치 (에이전트 환경)

### Grok

```bash
# 이 저장소를 clone 하거나, SKILL만 복사
cp -R skills/diagonse ~/.grok/skills/diagonse
```

이후 대화에서 `/diagonse` 또는 “홈페이지 마케팅 진단” 트리거.

### Claude Code / Cursor

```bash
cp -R skills/diagonse .claude/skills/diagonse
# 또는 유저 스킬
cp -R skills/diagonse ~/.claude/skills/diagonse
```

### 다른 LLM 에이전트

`skills/diagonse/SKILL.md` 내용을 시스템/스킬 프롬프트에 넣고,  
도구로 `POST https://diagonse.vercel.app/api/diagnose` 를 허용하면 됩니다.

## 스킬 vs UI

| | 생성형 AI 스킬 (이 저장소) | 사람용 UI (`ai-agent-site`) |
|--|---------------------------|------------------------------|
| 입력 | URL + 회사명 (대화) | 웹 폼·마법사 |
| 실행 | 에이전트 + 헤드리스 엔진 | 브라우저 |
| 출력 | Markdown 파일 | 화면 + 로컬 저장 |
| 목적 | 프롬프트 한 줄 자동화 | 실측 체크·컨설턴트 워크플로 |

## 스킬이 호출하는 실행 계층 (구현 상세)

에이전트가 직접 HTML을 전부 손으로 채점하지 않도록, 같은 저장소에 **헤드리스 러너**가 있습니다.

```
POST https://diagonse.vercel.app/api/diagnose
{ "url": "...", "company": "..." }
→ { markdown, scores, filename, beforeAfter, ... }
```

로컬:

```bash
npm install
npx tsx scripts/diagnose-cli.ts "https://example.com" "회사명" "키워드1,키워드2"
```

API 키(선택): Vercel env `DIAGNOSE_API_KEY` → `Authorization: Bearer …`

## 보고서가 담는 것

- 표면 신호 점수 (HTML)  
- **브랜드=서비스 연결** (네이버 브랜드 검색 전략 · before_after)  
- 네이버 서치어드바이저 **기술 전제** 점검  
- Before→After 문안 · 실검색 KPI 링크 · 체크리스트  

## License / 한계

검색 순위·노출은 보장하지 않습니다. 가이드 준수 ≠ 상위 노출.
