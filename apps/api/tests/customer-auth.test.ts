import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

process.env.JWT_SECRET ??= "unit-test-secret-with-at-least-32-bytes";
process.env.KYC_ENCRYPTION_KEY ??= "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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

test("customer profile returns only the database identity bound to the authenticated session", async () => {
  process.env.DB_USER ??= "customer-profile-test";
  process.env.DB_NAME ??= "customer_profile_test";
  const [{ default: express }, { default: database }, { customerProfileRouter }, tokens] = await Promise.all([
    import("express"),
    import("../src/config/database"),
    import("../src/modules/customer-auth/routes"),
    import("../src/modules/customer-auth/tokens"),
  ]);

  const token = tokens.createCustomerToken(42, "+919876543210");
  const otherToken = tokens.createCustomerToken(43, "+919876543211");
  const tokenHash = tokens.hashCustomerToken(token);
  let verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" = "PENDING";
  const originalExecute = Object.getOwnPropertyDescriptor(database, "execute");
  Object.defineProperty(database, "execute", {
    configurable: true,
    value: async (sql: string, values: unknown[] = []) => {
      assert.match(sql, /INNER JOIN users u ON u\.user_id = s\.user_id/);
      assert.match(sql, /WHERE s\.token_hash = \?/);
      if (!Buffer.isBuffer(values[0]) || !values[0].equals(tokenHash)) return [[], []];
      return [[{
        user_id: 42,
        full_name: "Test Customer",
        mobile: "+919876543210",
        email: "customer@example.com",
        verification_status: verificationStatus,
      }], []];
    },
  });

  const app = express();
  app.use("/api/customer/me", customerProfileRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  const apiBase = `http://127.0.0.1:${address.port}/api/customer/me`;

  try {
    const response = await fetch(`${apiBase}?customerId=43`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      profile: {
        id: "CUS-42",
        name: "Test Customer",
        mobileNumber: "+919876543210",
        email: "customer@example.com",
        kycStatus: "PENDING",
      },
    });

    verificationStatus = "VERIFIED";
    const approvedResponse = await fetch(apiBase, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal((await approvedResponse.json()).profile.kycStatus, "APPROVED");

    verificationStatus = "REJECTED";
    const rejectedResponse = await fetch(apiBase, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal((await rejectedResponse.json()).profile.kycStatus, "REJECTED");

    const otherResponse = await fetch(apiBase, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.equal(otherResponse.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (originalExecute) Object.defineProperty(database, "execute", originalExecute);
    else Reflect.deleteProperty(database, "execute");
  }
});

test("KYC document validation enforces Aadhaar checksum and encrypts document values", async () => {
  const { decryptKycDocument, encryptKycDocument, validateKycDocument } = await import(
    "../src/modules/customer-auth/kyc"
  );
  assert.deepEqual(validateKycDocument("aadhaar", "2000 0000 0009"), {
    documentType: "aadhaar",
    documentNumber: "200000000009",
  });
  assert.deepEqual(validateKycDocument("pan", "abcde1234f"), {
    documentType: "pan",
    documentNumber: "ABCDE1234F",
  });
  assert.throws(() => validateKycDocument("aadhaar", "200000000008"), /valid 12-digit Aadhaar/);
  assert.throws(() => validateKycDocument("pan", "ABCDE12345"), /valid PAN/);
  assert.throws(() => validateKycDocument("passport", "ABCDE1234F"), /Choose Aadhaar Card or PAN Card/);

  const encrypted = encryptKycDocument("ABCDE1234F");
  assert.notEqual(encrypted.ciphertext.toString("utf8"), "ABCDE1234F");
  assert.equal(decryptKycDocument(encrypted.ciphertext, encrypted.iv, encrypted.authTag), "ABCDE1234F");
  const tampered = Buffer.from(encrypted.ciphertext);
  tampered[0] ^= 1;
  assert.throws(() => decryptKycDocument(tampered, encrypted.iv, encrypted.authTag));
});

test("customers cannot submit KYC documents from the customer API", async () => {
  const [{ default: express }, { default: customerAuthRouter }] = await Promise.all([
    import("express"),
    import("../src/modules/customer-auth/routes"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api/customer/auth", customerAuthRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/customer/auth/kyc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentType: "pan", documentNumber: "ABCDE1234F", consent: true }),
    });
    assert.equal(response.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
