import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../src/modules/auth/credentials";

test("password hashes verify the original password without storing it in plaintext", async () => {
  const password = "a-long-unique-password";
  const passwordHash = await hashPassword(password);

  assert.notEqual(passwordHash, password);
  assert.match(passwordHash, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword("a-different-password", passwordHash), false);
});

test("password verification rejects malformed hashes", async () => {
  assert.equal(await verifyPassword("password", "invalid"), false);
  assert.equal(await verifyPassword("password", "scrypt$16384$8$1$AA$AA"), false);
});
