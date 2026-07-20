/** v4.4 임시 배포 만료 가드 — DEPLOY_EXPIRES_AT 미설정 시 무제한 동작, 설정 시 해당 시각 이후 차단 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getExpiryDate, isDeploymentExpired, expiryDateLabel, expiryMessage } from "../lib/deployment-expiry";

describe("deployment-expiry", () => {
  it("환경변수 미설정 시 무제한(만료 없음)", () => {
    assert.equal(getExpiryDate({}), null);
    assert.equal(isDeploymentExpired({}), false);
    assert.equal(expiryDateLabel({}), null);
  });

  it("잘못된 날짜 형식은 무시하고 무제한 취급", () => {
    const env = { DEPLOY_EXPIRES_AT: "not-a-date" };
    assert.equal(getExpiryDate(env), null);
    assert.equal(isDeploymentExpired(env), false);
  });

  it("만료 시각 이전에는 정상 동작", () => {
    const env = { DEPLOY_EXPIRES_AT: "2099-01-01T00:00:00+09:00" };
    assert.equal(isDeploymentExpired(env, new Date("2026-07-20T00:00:00+09:00")), false);
  });

  it("만료 시각 이후에는 차단 + 안내 메시지에 날짜 포함", () => {
    const env = { DEPLOY_EXPIRES_AT: "2026-07-25T23:59:59+09:00" };
    assert.equal(isDeploymentExpired(env, new Date("2026-07-26T00:00:01+09:00")), true);
    assert.equal(isDeploymentExpired(env, new Date("2026-07-25T23:59:59+09:00")), true); // 경계값 포함
    const msg = expiryMessage(env);
    assert.ok(msg.includes("종료되었습니다"));
    assert.ok(msg.includes("컨설턴트"));
  });
});
