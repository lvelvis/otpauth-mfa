import assert from "node:assert/strict";
import test from "node:test";

import { parseOtpAuthUri } from "../src/otpauth.js";

test("解析标准 TOTP URI", () => {
  const result = parseOtpAuthUri(
    "otpauth://totp/Jenkins:admin%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Jenkins",
  );

  assert.deepEqual(result, {
    account: "admin@example.com",
    algorithm: "SHA1",
    digits: 6,
    issuer: "Jenkins",
    period: 30,
    secret: "JBSWY3DPEHPK3PXP",
    type: "TOTP",
    uri: "otpauth://totp/Jenkins:admin%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Jenkins",
  });
});

test("规范化带空格和连字符的 Base32 密钥", () => {
  const result = parseOtpAuthUri(
    "otpauth://totp/example?secret=jbsw-y3dp%20ehpk3pxp&algorithm=SHA256&digits=8&period=60",
  );

  assert.equal(result.secret, "JBSWY3DPEHPK3PXP");
  assert.equal(result.algorithm, "SHA256");
  assert.equal(result.digits, 8);
  assert.equal(result.period, 60);
});

test("拒绝普通网址二维码", () => {
  assert.throws(
    () => parseOtpAuthUri("https://example.com/?secret=JBSWY3DPEHPK3PXP"),
    /不是 otpauth/,
  );
});

test("解析 HOTP 二维码", () => {
  const result = parseOtpAuthUri(
    "otpauth://hotp/example?secret=JBSWY3DPEHPK3PXP&counter=1",
  );

  assert.equal(result.type, "HOTP");
  assert.equal(result.counter, 1);
  assert.equal(result.secret, "JBSWY3DPEHPK3PXP");
});

test("兼容将类型放在路径中的非标准 URI", () => {
  const result = parseOtpAuthUri(
    "otpauth:///totp/Jenkins:test?secret=JBSWY3DPEHPK3PXP&issuer=Jenkins",
  );

  assert.equal(result.type, "TOTP");
  assert.equal(result.account, "test");
  assert.equal(result.period, 30);
});

test("未声明类型时仍提取密钥", () => {
  const result = parseOtpAuthUri(
    "otpauth:///?secret=JBSWY3DPEHPK3PXP&issuer=Jenkins",
  );

  assert.equal(result.type, "OTP");
  assert.equal(result.account, "未提供");
  assert.equal(result.secret, "JBSWY3DPEHPK3PXP");
});

test("拒绝无效 Base32 密钥", () => {
  assert.throws(
    () => parseOtpAuthUri("otpauth://totp/example?secret=INVALID0189"),
    /Base32/,
  );
});
