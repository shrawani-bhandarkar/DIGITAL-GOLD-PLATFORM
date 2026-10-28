import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { calculateOrderAmounts, calculateRedemptionAmounts } from "../src/modules/admin-console/financial";

const product = {
  buyRate: 100,
  sellRate: 90,
  minOrder: 1,
  maxOrder: 10000,
  buyChargeBps: 100,
  buyTaxBps: 1800,
  sellChargeBps: 100,
  sellTaxBps: 1800,
  minBuyQuantity: "0.001",
  maxBuyQuantity: "100",
  minSellQuantity: "0.001",
  maxSellQuantity: "100",
  redemptionEnabled: true,
  allowCoinDelivery: true,
  allowCashPayout: true,
  minRedemptionQuantity: "0.1",
  maxRedemptionQuantity: "100",
  redemptionChargePaise: 25000,
  redemptionTaxBps: 1800,
};

test("server applies the same fixed making charge for different buy quantities", () => {
  const order = calculateOrderAmounts({ type: "Buy", quantity: 2, amount: 1, charges: 0 }, product, "1.00", true);
  const largerOrder = calculateOrderAmounts({ type: "Buy", quantity: 10, amount: 1, charges: 0 }, product, "1.00", true);

  assert.equal(order.baseAmount, 200);
  assert.equal(order.makingCharges, 1);
  assert.equal(order.charges, 2);
  assert.equal(order.taxes, 0.36);
  assert.equal(order.amount, 203.36);
  assert.equal(largerOrder.makingCharges, order.makingCharges);
});

test("server preserves a 400 rupee fixed making charge for every purchase size", () => {
  for (const quantity of [1, 20]) {
    const order = calculateOrderAmounts({ type: "Buy", quantity }, product, "400.00", true);
    assert.equal(order.makingCharges, 400);
    assert.equal(order.makingChargePerPurchase, 400);
  }
});

test("server calculates percentage making charges from the metal value", () => {
  const order = calculateOrderAmounts({ type: "Buy", quantity: 2 }, product, "2.50", true, "percentage");
  assert.equal(order.baseAmount, 200);
  assert.equal(order.makingChargeType, "percentage");
  assert.equal(order.makingChargeValue, 2.5);
  assert.equal(order.makingCharges, 5);
  assert.equal(order.amount, 207.36);
});

test("Super Admin can save fixed and percentage making charges for each metal", async () => {
  process.env.JWT_SECRET ??= "admin-making-charge-test-secret-with-at-least-32-bytes";
  process.env.DB_USER ??= "admin-making-charge-test";
  process.env.DB_NAME ??= "admin_making_charge_test";
  const [{ default: express }, { default: database }, { default: adminConsoleRouter }, tokens] =
    await Promise.all([
      import("express"),
      import("../src/config/database"),
      import("../src/modules/admin-console/routes"),
      import("../src/modules/auth/tokens"),
    ]);

  const savedCharges = new Map<string, { metal: string; charge_type: string; charge_value: string; enabled: number; updated_at: string }>();
  const originalExecute = database.execute.bind(database);
  database.execute = (async (sql: string, values: unknown[] = []) => {
    if (sql.includes("FROM superadmin_jwt_sessions")) {
      return [[{ id: 1, email: "owner@example.test" }], []];
    }
    if (sql.includes("INSERT INTO admin_metal_making_charges")) {
      const [metalValue, chargeTypeValue, chargeValueValue, enabledValue] = values;
      const metal = String(metalValue);
      savedCharges.set(metal, {
        metal,
        charge_type: String(chargeTypeValue),
        charge_value: String(chargeValueValue),
        enabled: Number(enabledValue),
        updated_at: "2026-10-27 08:00:00",
      });
      return [{ affectedRows: 1 }, []];
    }
    if (sql.includes("SELECT metal, charge_type, charge_value, enabled, updated_at")) {
      const row = savedCharges.get(String(values[0]));
      return [row ? [row] : [], []];
    }
    throw new Error(`Unexpected database query in making-charge test: ${sql}`);
  }) as typeof database.execute;

  const app = express();
  app.use(express.json());
  app.use("/api/admin/console", adminConsoleRouter);
  const server = app.listen(0);
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const token = tokens.createAdminToken({
      id: 1,
      email: "owner@example.test",
      role: "SUPER_ADMIN",
      accountType: "superadmin",
    });
    for (const metal of ["Gold", "Silver", "Platinum"]) {
      for (const [chargeType, chargeValue] of [["fixed", "250.00"], ["percentage", "2.50"]] as const) {
        const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/console/making-charges/${metal}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Cookie: `dg_admin_session=${token}`,
          },
          body: JSON.stringify({ chargeType, chargeValue, enabled: true }),
        });
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).makingCharge, {
          metal,
          chargeType,
          chargeValue: Number(chargeValue),
          enabled: true,
          updatedAt: "2026-10-27 08:00:00",
        });
        assert.deepEqual(savedCharges.get(metal), {
          metal,
          charge_type: chargeType,
          charge_value: chargeValue,
          enabled: 1,
          updated_at: "2026-10-27 08:00:00",
        });
      }
    }
  } finally {
    database.execute = originalExecute;
    server.close();
    await once(server, "close");
  }
});

test("customer KYC document access is permission-gated and reviews update overall status", async () => {
  process.env.JWT_SECRET ??= "admin-customer-kyc-test-secret-with-at-least-32-bytes";
  process.env.KYC_ENCRYPTION_KEY ??= "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.DB_USER ??= "admin-customer-kyc-test";
  process.env.DB_NAME ??= "admin_customer_kyc_test";
  const [{ default: express }, { default: database }, { default: adminConsoleRouter }, tokens, kyc] =
    await Promise.all([
      import("express"),
      import("../src/config/database"),
      import("../src/modules/admin-console/routes"),
      import("../src/modules/auth/tokens"),
      import("../src/modules/customer-auth/kyc"),
    ]);

  const adminToken = tokens.createAdminToken({ id: 2, email: "reviewer@example.test", role: "ADMIN" });
  const deniedToken = tokens.createAdminToken({ id: 3, email: "readonly@example.test", role: "ADMIN" });
  const superAdminToken = tokens.createAdminToken({
    id: 1,
    email: "owner@example.test",
    role: "SUPER_ADMIN",
    accountType: "superadmin",
  });
  const adminHash = tokens.hashAdminToken(adminToken);
  const deniedHash = tokens.hashAdminToken(deniedToken);
  const superAdminHash = tokens.hashAdminToken(superAdminToken);
  const encrypted = kyc.encryptKycDocument("ABCDE1234F");
  const originalExecute = Object.getOwnPropertyDescriptor(database, "execute");
  const originalGetConnection = Object.getOwnPropertyDescriptor(database, "getConnection");
  const writes: Array<{ sql: string; values: unknown[] }> = [];
  let activeAdminHasCustomerPermission = false;
  Object.defineProperty(database, "execute", {
    configurable: true,
    value: async (sql: string, values: unknown[] = []) => {
      if (sql.includes("FROM admin_jwt_sessions")) {
        const hash = String(values[0]);
        if (hash === adminHash) {
          activeAdminHasCustomerPermission = true;
          return [[{ id: 2, email: "reviewer@example.test", role: "ADMIN" }], []];
        }
        if (hash === deniedHash) {
          activeAdminHasCustomerPermission = false;
          return [[{ id: 3, email: "readonly@example.test", role: "ADMIN" }], []];
        }
      }
      if (sql.includes("FROM superadmin_jwt_sessions") && String(values[0]) === superAdminHash) {
        return [[{ id: 1, email: "owner@example.test" }], []];
      }
      if (sql.includes("FROM admin_role_permissions")) {
        return [[{ permission_key: "customers", allowed: Number(activeAdminHasCustomerPermission) }], []];
      }
      if (sql.includes("FROM customer_kyc_documents")) {
        return [[{
          document_type: "pan",
          encrypted_document: encrypted.ciphertext,
          encryption_iv: encrypted.iv,
          encryption_tag: encrypted.authTag,
          status: "PENDING",
          submitted_at: "2026-10-27 08:00:00",
          reviewed_at: null,
        }], []];
      }
      throw new Error(`Unexpected admin KYC database query: ${sql}`);
    },
  });
  Object.defineProperty(database, "getConnection", {
    configurable: true,
    value: async () => ({
      beginTransaction: async () => {},
      execute: async (sql: string, values: unknown[] = []) => {
        writes.push({ sql, values });
        if (sql.includes("SELECT document_type FROM customer_kyc_documents")) return [[{ document_type: "pan" }], []];
        if (sql.includes("SELECT COUNT(*) AS total")) return [[{ total: 1, verified: 1, pending: 0 }], []];
        return [{ affectedRows: 1 }, []];
      },
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    }),
  });

  const app = express();
  app.use(express.json());
  app.use("/api/admin/console", adminConsoleRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/admin/console/customers/CUS-42/kyc`;

  try {
    const deniedResponse = await fetch(endpoint, { headers: { Cookie: `dg_admin_session=${deniedToken}` } });
    assert.equal(deniedResponse.status, 403);

    for (const token of [adminToken, superAdminToken]) {
      const response = await fetch(endpoint, { headers: { Cookie: `dg_admin_session=${token}` } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const result = await response.json();
      assert.equal(result.documents[0].documentType, "pan");
      assert.equal(result.documents[0].documentNumber, "ABCDE1234F");
    }

    const invalidDocumentResponse = await fetch(endpoint, {
      method: "PATCH",
      headers: { Cookie: `dg_admin_session=${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ documentType: "aadhaar", documentNumber: "123", status: "Approved" }),
    });
    assert.equal(invalidDocumentResponse.status, 400);

    const reviewResponse = await fetch(endpoint, {
      method: "PATCH",
      headers: { Cookie: `dg_admin_session=${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ documentType: "pan", documentNumber: "ABCDE1234F", status: "Approved" }),
    });
    assert.equal(reviewResponse.status, 200);
    assert.deepEqual(await reviewResponse.json(), {
      success: true,
      documentType: "pan",
      documentStatus: "Approved",
      kycStatus: "Approved",
    });
    const documentInsert = writes.find(({ sql }) => sql.includes("INSERT INTO customer_kyc_documents"));
    assert.ok(documentInsert);
    const ciphertext = documentInsert.values[2];
    assert.ok(Buffer.isBuffer(ciphertext));
    assert.notEqual((ciphertext as Buffer).toString("utf8"), "ABCDE1234F");
    assert.equal(kyc.decryptKycDocument(
      ciphertext as Buffer,
      documentInsert.values[3] as Buffer,
      documentInsert.values[4] as Buffer,
    ), "ABCDE1234F");
    assert.ok(writes.some(({ sql }) => sql.includes("UPDATE users SET verification_status")));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (originalExecute) Object.defineProperty(database, "execute", originalExecute);
    else Reflect.deleteProperty(database, "execute");
    if (originalGetConnection) Object.defineProperty(database, "getConnection", originalGetConnection);
    else Reflect.deleteProperty(database, "getConnection");
  }
});

test("server recalculates sell proceeds and rejects invalid balances at route layer", () => {
  const order = calculateOrderAmounts({ type: "Sell", quantity: 2, amount: 999999 }, product);

  assert.equal(order.baseAmount, 180);
  assert.equal(order.charges, 1.8);
  assert.equal(order.taxes, 0.32);
  assert.equal(order.amount, 177.88);
});

test("redemption totals follow delivery or payout rules", () => {
  const delivery = calculateRedemptionAmounts({ mode: "Coin delivery", quantity: 2, amount: 1 }, product);
  const payout = calculateRedemptionAmounts({ mode: "Cash payout", quantity: 2, amount: 99999 }, product);

  assert.equal(delivery.grossAmount, 200);
  assert.equal(delivery.deliveryCharge, 250);
  assert.equal(delivery.taxes, 45);
  assert.equal(delivery.amount, 495);
  assert.equal(payout.amount, 180);
});

test("server rejects order and redemption values outside configured rules", () => {
  assert.throws(() => calculateOrderAmounts({ type: "Buy", quantity: 101 }, product), /configured limits/);
  assert.throws(() => calculateRedemptionAmounts({ mode: "Coin delivery", quantity: 0.01 }, product), /configured limits/);
});
