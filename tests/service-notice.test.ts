/** v4.5 서비스 공지 배너 — SERVICE_NOTICE 미설정 시 비활성, 설정 시 문구 그대로 노출 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getServiceNotice } from "../lib/service-notice";

describe("service-notice", () => {
  it("미설정 시 null(배너 없음)", () => {
    assert.equal(getServiceNotice({}), null);
  });

  it("빈 문자열/공백만 있으면 null 취급", () => {
    assert.equal(getServiceNotice({ SERVICE_NOTICE: "" }), null);
    assert.equal(getServiceNotice({ SERVICE_NOTICE: "   " }), null);
  });

  it("설정 시 앞뒤 공백만 제거해 그대로 반환", () => {
    const env = { SERVICE_NOTICE: "  GPT-5.6 API 토큰이 모두 소진되어 AI 진단이 동작하지 않습니다.  " };
    assert.equal(getServiceNotice(env), "GPT-5.6 API 토큰이 모두 소진되어 AI 진단이 동작하지 않습니다.");
  });
});
