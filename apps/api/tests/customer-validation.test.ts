import assert from "node:assert/strict";
import { test } from "node:test";
import { validateNewCustomer } from "../src/modules/admin-console/customer-validation";

const validCustomer = {
  name: "Priya Kapoor",
  email: "priya@example.com",
  phone: "9876543210",
  city: "Pune",
  pan: "ABCDE1234F",
};

test("customer validation requires all five non-empty fields", () => {
  for (const field of Object.keys(validCustomer)) {
    assert.throws(
      () => validateNewCustomer({ ...validCustomer, [field]: "  " }),
      new RegExp(`${field === "name" ? "Full name" : field} is required`, "i"),
    );
  }
});

test("customer validation normalizes values and validates email, phone, and PAN formats", () => {
  assert.deepEqual(validateNewCustomer({
    ...validCustomer,
    name: "  Priya Kapoor ",
    email: " PRIYA@example.com ",
    pan: "abcde1234f",
  }), { ...validCustomer, email: "priya@example.com" });

  assert.throws(() => validateNewCustomer({ ...validCustomer, email: "invalid-email" }), /valid email address/);
  assert.throws(() => validateNewCustomer({ ...validCustomer, phone: "+919876543210" }), /exactly 10 digits/);
  assert.throws(() => validateNewCustomer({ ...validCustomer, pan: "ABCDE1234" }), /valid PAN/);
});
