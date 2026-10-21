import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidPassword } from "../src/modules/auth/password-validation";

test("password validation requires length and all four character categories", () => {
  assert.equal(isValidPassword("Admin123!"), true);
  assert.equal(isValidPassword("OwnerPass123!"), true);
  assert.equal(isValidPassword("short1A!"), true);
  assert.equal(isValidPassword("Short1!"), false);
  assert.equal(isValidPassword("lowercase1!"), false);
  assert.equal(isValidPassword("UPPERCASE1!"), false);
  assert.equal(isValidPassword("NoNumber!"), false);
  assert.equal(isValidPassword("NoSpecial123"), false);
});

