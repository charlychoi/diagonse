import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { callGlmApi } from "../lib/glm-api-client";

describe("callGlmApi", () => {
  it("requires a server-side API key", async () => {
    await assert.rejects(
      callGlmApi("test", { apiKey: "" }),
      /GLM_API_KEY/,
    );
  });

  it("extracts chat completion text and citations", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const body = JSON.parse(String(init?.body));
      assert.match(String(input), /api\.z\.ai\/api\/paas\/v4\/chat\/completions$/);
      assert.equal(body.model, "glm-5.2");
      assert.equal(body.messages[0].content, "diagnose");
      assert.equal(body.thinking.type, "disabled");
      assert.equal(body.tools[0].web_search.search_engine, "search_pro_jina");
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-key");
      return new Response(JSON.stringify({
        choices: [{
          message: { content: '{"summary":"ok","priorities":[],"messaging":null,"competitorCandidates":[]}' },
        }],
        web_search: [{ url: "https://example.com/source", title: "Example" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const result = await callGlmApi("diagnose", { apiKey: "test-key", fetchImpl });
    assert.equal(result.provider, "glm");
    assert.equal(result.model, "glm-5.2");
    assert.match(result.output, /"summary":"ok"/);
    assert.deepEqual(result.citations, ["https://example.com/source"]);
  });

  it("surfaces API error messages", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { message: "invalid api key" } }), { status: 401 });
    await assert.rejects(callGlmApi("x", { apiKey: "bad", fetchImpl }), /invalid api key/);
  });
});
