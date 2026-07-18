import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { callXaiApi } from "../lib/xai-api-client";

describe("callXaiApi", () => {
  it("requires a server-side API key", async () => {
    await assert.rejects(
      callXaiApi("test", { apiKey: "" }),
      /XAI_API_KEY/,
    );
  });

  it("extracts Responses API text and citations", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "grok-4.5");
      assert.deepEqual(body.tools, [{ type: "web_search" }]);
      assert.match(String((init?.headers as Record<string, string>).Authorization), /^Bearer /);
      return new Response(JSON.stringify({
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: '{"summary":"ok","priorities":[],"messaging":null,"competitorCandidates":[]}',
            annotations: [{ type: "url_citation", url: "https://example.com/source" }],
          }],
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    const result = await callXaiApi("diagnose", { apiKey: "test-key", fetchImpl });
    assert.equal(result.provider, "xai");
    assert.equal(result.model, "grok-4.5");
    assert.match(result.output, /"summary":"ok"/);
    assert.deepEqual(result.citations, ["https://example.com/source"]);
  });
});
