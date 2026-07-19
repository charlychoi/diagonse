import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLocalCliCommand, callLocalCliAi } from "../lib/local-cli-ai";

describe("local OAuth CLI transports", () => {
  it("builds a read-only ephemeral Codex command", () => {
    const spec = buildLocalCliCommand("codex_cli", "분석", {
      env: { CODEX_MODEL: "gpt-5.6" },
    });
    assert.equal(spec.command, "codex");
    assert.ok(spec.args.includes("--ephemeral"));
    assert.ok(spec.args.includes("read-only"));
    assert.ok(spec.args.includes("--ignore-user-config"));
    assert.ok(spec.args.at(-1)?.includes("로컬 파일"));
  });

  it("builds an isolated Grok headless command", () => {
    const spec = buildLocalCliCommand("grok_cli", "분석", {
      env: { GROK_MODEL: "grok-4.5" },
    });
    assert.equal(spec.command, "grok");
    assert.ok(spec.args.includes("--no-memory"));
    assert.ok(spec.args.includes("--no-subagents"));
    assert.ok(spec.args.includes("grok-4.5"));
  });

  it("returns clean model output and extracts citations", async () => {
    const result = await callLocalCliAi("grok_cli", "분석", {
      env: { GROK_MODEL: "grok-4.5" },
      runCommand: async () => ({
        stdout: '{"ok":true,"source":"https://example.com/page"}',
        stderr: "ignored warning",
      }),
    });
    assert.equal(result.provider, "xai");
    assert.equal(result.model, "grok-4.5");
    assert.deepEqual(result.citations, ["https://example.com/page"]);
  });
});
