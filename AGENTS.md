# Agent instructions — Diagonse

This repository supports both a public Sites deployment and local development.

- Run with `npm run dev`; the UI binds to `127.0.0.1`.
- Build the Sites artifact with `npm run build:sites`.
- Local OAuth testing uses an authenticated Grok or Codex CLI; OAuth tokens must remain in the CLI's protected local session.
- Clones may supply their own Anthropic, OpenAI, Gemini, or xAI API key in `.env.local`.
- The public Sites deployment must not contain the repository owner's LLM API keys or OAuth credentials; without a user-supplied server key it uses the rule-based fallback.
- Never commit, print, or expose API keys to the browser.
- Run `npm test`, `npm run build`, and `npm run build:sites` after implementation changes.
