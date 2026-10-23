import assert from "node:assert/strict";
import { test } from "node:test";

process.env.JWT_SECRET ??= "unit-test-secret-with-at-least-32-bytes";

test("customer OTPs are keyed hashes and never stored as the supplied code", async () => {
  const { hashCustomerOtp } = await import("../src/modules/customer-auth/tokens");
  const firstHash = hashCustomerOtp("004219");
  const secondHash = hashCustomerOtp("004220");

  assert.equal(firstHash.length, 32);
  assert.notDeepEqual(firstHash, Buffer.from("004219"));
  assert.notDeepEqual(firstHash, secondHash);
});

test("customer sessions are signed for customer accounts and reject changed tokens", async () => {
  const { createCustomerToken, hashCustomerToken, verifyCustomerToken } = await import(
    "../src/modules/customer-auth/tokens"
  );
  const token = createCustomerToken(42, "+919876543210");
  const claims = verifyCustomerToken(token);

  assert.equal(claims?.sub, "42");
  assert.equal(claims?.accountType, "customer");
  assert.equal(claims?.mobileNumber, "+919876543210");
  assert.equal(hashCustomerToken(token).length, 32);
  assert.equal(verifyCustomerToken(`${token}invalid`), null);
});
