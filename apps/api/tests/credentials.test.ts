import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../src/modules/auth/credentials";

test("password hashes use bcrypt and verify the seeded demo password", async () => {
  const password = "Admin123!";
  const passwordHash = await hashPassword(password);

  assert.notEqual(passwordHash, password);
  assert.match(passwordHash, /^\$2[aby]\$12\$/);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword("a-different-password", passwordHash), false);
});

test("password verification rejects malformed hashes", async () => {
  assert.equal(await verifyPassword("password", "invalid"), false);
  assert.equal(await verifyPassword("password", "scrypt$16384$8$1$AA$AA"), false);
});
