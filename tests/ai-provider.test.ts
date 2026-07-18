import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAiConfig, aiEnabled } from "../lib/ai-provider";

describe("resolveAiConfig — 공개=Claude / 내부=Grok 게이팅", () => {
  it("공개: ANTHROPIC 키 있으면 anthropic", () => {
    const c = resolveAiConfig({ ANTHROPIC_API_KEY: "sk-ant" });
    assert.equal(c.provider, "anthropic");
    assert.equal(c.mode, "public");
  });

  it("Grok 키가 있어도 AI_MODE!=internal 이면 Grok 미사용(공개=anthropic)", () => {
    const c = resolveAiConfig({ ANTHROPIC_API_KEY: "sk-ant", XAI_API_KEY: "xai" });
    assert.equal(c.provider, "anthropic");
  });

  it("내부: AI_MODE=internal + XAI 키면 xai(Grok)", () => {
    const c = resolveAiConfig({ AI_MODE: "internal", XAI_API_KEY: "xai" });
    assert.equal(c.provider, "xai");
    assert.equal(c.mode, "internal");
  });

  it("내부 모드지만 XAI 키 없고 ANTHROPIC 있으면 anthropic로 폴백", () => {
    const c = resolveAiConfig({ AI_MODE: "internal", ANTHROPIC_API_KEY: "sk-ant" });
    assert.equal(c.provider, "anthropic");
  });

  it("키가 전혀 없으면 none", () => {
    const c = resolveAiConfig({});
    assert.equal(c.provider, "none");
    assert.equal(aiEnabled({}), false);
  });
});
