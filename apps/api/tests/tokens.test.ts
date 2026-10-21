import assert from "node:assert/strict";
import { test } from "node:test";

test("admin JWTs are signed, expire, and have a one-way session key", async () => {
  process.env.JWT_SECRET ??= "unit-test-secret-with-at-least-32-bytes";
  const { createAdminToken, hashAdminToken, verifyAdminToken } = await import(
    "../src/modules/auth/tokens"
  );

  const token = createAdminToken({
    id: 42,
    email: "admin@digitalgold.demo",
    role: "ADMIN",
  });
  const claims = verifyAdminToken(token);

  assert.equal(claims?.sub, "42");
  assert.equal(claims?.email, "admin@digitalgold.demo");
  assert.equal(claims?.role, "ADMIN");
  assert.equal(claims?.accountType, "admin");
  assert.ok(claims && claims.exp! > Math.floor(Date.now() / 1000));
  assert.equal(hashAdminToken(token).length, 32);
  assert.equal(verifyAdminToken(`${token}invalid`), null);

  const superAdminToken = createAdminToken({
    id: 7,
    email: "owner@digitalgold.demo",
    role: "SUPER_ADMIN",
    accountType: "superadmin",
  });
  assert.equal(verifyAdminToken(superAdminToken)?.accountType, "superadmin");
});
