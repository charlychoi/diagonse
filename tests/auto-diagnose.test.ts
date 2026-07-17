import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateAutoRequest } from "../lib/auto-diagnose";

describe("validateAutoRequest", () => {
  it("requires url and company", () => {
    const a = validateAutoRequest({});
    assert.equal(a.ok, false);
    const b = validateAutoRequest({ url: "https://x.com" });
    assert.equal(b.ok, false);
    const c = validateAutoRequest({
      url: "https://x.com",
      company: "테스트",
    });
    assert.equal(c.ok, true);
    if (c.ok) assert.equal(c.data.company, "테스트");
  });

  it("accepts companyName / brand aliases", () => {
    const r = validateAutoRequest({
      url: "example.com",
      brand: "브랜드",
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.data.company, "브랜드");
  });
});
