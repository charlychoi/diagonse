# Agent instructions — Diagonse

This repository supports both a public Sites deployment and local development.

- Run with `npm run dev`; the UI binds to `127.0.0.1`.
- Build the Sites artifact with `npm run build:sites`.
- AI inference uses the xAI Responses API with `grok-4.5` and `web_search`.
- Local clones must supply their own `XAI_API_KEY` in `.env.local`; hosted deployments use a secret environment variable.
- Never commit, print, or expose API keys to the browser.
- Run `npm test`, `npm run build`, and `npm run build:sites` after implementation changes.
