import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { callGeminiApi } from "../lib/gemini-api-client";

describe("callGeminiApi", () => {
  it("requires a server-side API key", async () => {
    await assert.rejects(
      callGeminiApi("test", { apiKey: "" }),
      /GEMINI_API_KEY/,
    );
  });

  it("extracts generateContent text and grounding citations", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const body = JSON.parse(String(init?.body));
      assert.match(String(input), /gemini-2\.5-pro:generateContent$/);
      assert.deepEqual(body.tools, [{ google_search: {} }]);
      assert.equal((init?.headers as Record<string, string>)["x-goog-api-key"], "test-key");
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: '{"summary":"ok","priorities":[],"messaging":null,"competitorCandidates":[]}' }],
          },
          groundingMetadata: {
            groundingChunks: [{ web: { uri: "https://example.com/source", title: "Example" } }],
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const result = await callGeminiApi("diagnose", { apiKey: "test-key", fetchImpl });
    assert.equal(result.provider, "gemini");
    assert.equal(result.model, "gemini-2.5-pro");
    assert.match(result.output, /"summary":"ok"/);
    assert.deepEqual(result.citations, ["https://example.com/source"]);
  });
});
