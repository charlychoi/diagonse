import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAiConfig, aiEnabled } from "../lib/ai-provider";

describe("resolveAiConfig — local OAuth / clone-owned API", () => {
  it("local-oauth defaults to Grok CLI without any API key", () => {
    const c = resolveAiConfig({ AI_MODE: "local-oauth" });
    assert.equal(c.provider, "grok_cli");
    assert.equal(c.mode, "local");
  });

  it("local-oauth can select Codex CLI", () => {
    const c = resolveAiConfig({ AI_MODE: "local-oauth", AI_PROVIDER: "codex", CODEX_MODEL: "gpt-5.6" });
    assert.equal(c.provider, "codex_cli");
    assert.match(c.label, /gpt-5\.6/);
  });

  it("selects a clone owner's Claude API key", () => {
    const c = resolveAiConfig({ AI_PROVIDER: "claude", ANTHROPIC_API_KEY: "sk-ant" });
    assert.equal(c.provider, "anthropic");
    assert.equal(c.mode, "api");
  });

  it("selects a clone owner's OpenAI API key", () => {
    const c = resolveAiConfig({ AI_PROVIDER: "chatgpt", OPENAI_API_KEY: "sk-openai" });
    assert.equal(c.provider, "openai");
  });

  it("selects a clone owner's Gemini API key", () => {
    const c = resolveAiConfig({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "gm" });
    assert.equal(c.provider, "gemini");
  });

  it("selects a clone owner's Grok API key", () => {
    const c = resolveAiConfig({ AI_PROVIDER: "grok", XAI_API_KEY: "xai" });
    assert.equal(c.provider, "xai");
  });

  it("does not fall through to a different provider when an explicit provider lacks a key", () => {
    const c = resolveAiConfig({ AI_PROVIDER: "openai", ANTHROPIC_API_KEY: "sk-ant" });
    assert.equal(c.provider, "none");
  });

  it("uses the first available clone-owned API when no provider is specified", () => {
    const c = resolveAiConfig({ OPENAI_API_KEY: "sk-openai", GEMINI_API_KEY: "gm" });
    assert.equal(c.provider, "openai");
  });

  it("no key and no local OAuth mode means rule-based fallback", () => {
    const c = resolveAiConfig({});
    assert.equal(c.provider, "none");
    assert.equal(aiEnabled({}), false);
  });
});
