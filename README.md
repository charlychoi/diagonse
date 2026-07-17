# Diagonse — Generative-AI Auto Marketing Diagnosis API

**Headless** marketing diagnosis for AI agents.  
Give a **homepage URL + company name** → get a full **Markdown evaluation report**.

Interactive UI diagnosis stays on the main MarkDiag app. This repo is **API-only** for agents (Grok, Claude, ChatGPT tools, scripts).

Repo: https://github.com/charlychoi/diagonse

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Liveness |
| `GET` | `/api/diagnose` | Help schema (no params) or run diagnosis via query |
| `POST` | `/api/diagnose` | Run diagnosis (JSON body) |

### POST body

```json
{
  "url": "https://sangsangwoori.com/",
  "company": "상상우리",
  "keywords": ["AI 컨설팅", "AI 교육"],
  "industry": "AI 컨설팅·교육",
  "format": "json"
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `url` | ✅ | Homepage URL |
| `company` | ✅ | Brand / company name (`companyName` / `brand` aliases OK) |
| `keywords` | | Array or comma string |
| `industry` | | Optional industry context |
| `format` | | `json` (default) or `md` |

### GET example

```
GET /api/diagnose?url=https://sangsangwoori.com/&company=상상우리&keywords=AI%20컨설팅,AI%20교육&format=md
```

`format=md` returns `text/markdown` with `Content-Disposition` filename.

### Response (JSON)

- `scores.surfaceScore` — HTML surface score  
- `scores.brandServiceBinding` — brand=service signal strength (before_after strategy)  
- `scores.naverGuideScore` — Naver Search Advisor technical checklist  
- `markdown` — full report (save as `.md`)  
- `filename` — suggested file name  
- `beforeAfter` — concrete title/meta/H1 copy  
- `brandSearchQueries` — Naver search KPI links  

## Prompt for other AIs

```
웹사이트 {URL} 회사명 {COMPANY}를 Diagonse API로 마케팅 사전진단해 줘.
POST {BASE_URL}/api/diagnose
Content-Type: application/json
{"url":"{URL}","company":"{COMPANY}"}
응답 JSON의 markdown 필드를 {filename}으로 저장하고, 점수·브랜드연결·Before/After를 한국어로 요약 보고해.
```

## Auth (optional)

Set Vercel env `DIAGNOSE_API_KEY`. Clients must send:

```
Authorization: Bearer <DIAGNOSE_API_KEY>
```

or header `x-api-key`.

## Local

```bash
npm install
npm run dev
# http://localhost:3000/api/diagnose

npm run diagnose -- https://sangsangwoori.com/ 상상우리 "AI 컨설팅,AI 교육"
```

## Deploy (Vercel)

```bash
npx vercel --prod
```

Or connect GitHub repo `charlychoi/diagonse` in Vercel dashboard → Deploy.

Node.js **≥ 20**. Function max duration **60s** (homepage crawl).

## Architecture

```
app/api/diagnose  →  lib/auto-diagnose  →  crawl + analyzer + seo-playbook + naver-seo
```

Engine ports MarkDiag (surface score, brand-search strategy from `before_after.md`, Naver Search Advisor checklist). Interactive wizard (D1–D6) is **not** in this service.
