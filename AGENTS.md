# Agent instructions — Diagonse

This repository is a **Skill for generative AI**, not primarily a human web app.

When the user asks for marketing diagnosis of a website with URL + company name:

1. Load and follow `skills/diagonse/SKILL.md` (slash `/diagonse`).
2. Prefer POST https://diagonse.vercel.app/api/diagnose with `{url, company}`.
3. Save the returned `markdown` field to a `.md` file and summarize scores in Korean.
4. Do **not** open multi-step form UIs. Headless only.

Brand-search signal alignment (before_after strategy) is the business goal; Naver webmaster tech checks are prerequisites only.
