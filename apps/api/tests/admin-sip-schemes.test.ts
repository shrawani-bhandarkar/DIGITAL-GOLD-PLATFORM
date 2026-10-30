import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

test("Super Admin can persist SIP schemes while standard Admin is denied", async () => {
  process.env.JWT_SECRET ??= "admin-sip-scheme-test-secret-at-least-32-bytes";
  process.env.DB_USER ??= "admin-sip-scheme-test";
  process.env.DB_NAME ??= "admin_sip_scheme_test";
  const [{ default: express }, { default: database }, { default: adminConsoleRouter }, tokens] =
    await Promise.all([
      import("express"),
      import("../src/config/database"),
      import("../src/modules/admin-console/routes"),
      import("../src/modules/auth/tokens"),
    ]);

  const originalExecute = Object.getOwnPropertyDescriptor(database, "execute");
  let scheme: Record<string, unknown> | null = null;
  Object.defineProperty(database, "execute", {
    configurable: true,
    value: async (sql: string, values: unknown[] = []) => {
      if (sql.includes("FROM superadmin_jwt_sessions")) return [[{ id: 1, email: "owner@example.test" }], []];
      if (sql.includes("FROM admin_jwt_sessions")) return [[{ id: 2, email: "admin@example.test", role: "ADMIN" }], []];
      if (sql.includes("FROM admin_metal_products") && sql.includes("WHERE product_id = ?")) {
        return values[0] === "GOLD-24K" ? [[{ product_id: "GOLD-24K" }], []] : [[], []];
      }
      if (sql.includes("INSERT INTO sip_schemes")) {
        scheme = {
          scheme_id: values[0],
          scheme_name: values[1],
          product_id: values[2],
          minimum_amount: values[3],
          frequency: values[4],
          duration_months: values[5],
          charge_type: values[6],
          charge_value: values[7],
          tax_rate_bps: values[8],
          status: values[9],
          metal: "Gold",
          purity: "24K",
          created_at: "2026-01-01 00:00:00",
          updated_at: "2026-01-01 00:00:00",
        };
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE sip_schemes")) {
        if (scheme) {
          Object.assign(scheme, {
            scheme_name: values[0],
            product_id: values[1],
            minimum_amount: values[2],
            frequency: values[3],
            duration_months: values[4],
            charge_type: values[5],
            charge_value: values[6],
            tax_rate_bps: values[7],
            status: values[8],
          });
        }
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("FROM sip_schemes s") && sql.includes("WHERE s.scheme_id = ?")) {
        return scheme ? [[scheme], []] : [[], []];
      }
      throw new Error(`Unexpected SIP scheme database query: ${sql}`);
    },
  });

  const app = express();
  app.use(express.json());
  app.use("/api/admin/console", adminConsoleRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  const endpoint = `http://127.0.0.1:${address.port}/api/admin/console/sip-schemes`;
  const superAdminToken = tokens.createAdminToken({
    id: 1,
    email: "owner@example.test",
    role: "SUPER_ADMIN",
    accountType: "superadmin",
  });
  const adminToken = tokens.createAdminToken({
    id: 2,
    email: "admin@example.test",
    role: "ADMIN",
    accountType: "admin",
  });
  const schemeInput = {
    name: "Gold Monthly",
    productId: "GOLD-24K",
    minimumAmount: "1000",
    frequency: "Monthly",
    durationMonths: 12,
    chargeType: "percentage",
    chargeValue: "2.5",
    taxRateBps: 1800,
    status: "Active",
  };

  try {
    const denied = await fetch(endpoint, {
      method: "POST",
      headers: { Cookie: `dg_admin_session=${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(schemeInput),
    });
    assert.equal(denied.status, 403);

    const created = await fetch(endpoint, {
      method: "POST",
      headers: { Cookie: `dg_admin_session=${superAdminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(schemeInput),
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as Record<string, unknown>;
    assert.equal(createdBody.name, "Gold Monthly");
    assert.equal(createdBody.chargeType, "percentage");
    assert.equal(createdBody.chargeValue, 2.5);

    const updated = await fetch(`${endpoint}/${encodeURIComponent(String(createdBody.id))}`, {
      method: "PUT",
      headers: { Cookie: `dg_admin_session=${superAdminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...schemeInput, status: "Inactive", chargeType: "fixed", chargeValue: "25" }),
    });
    assert.equal(updated.status, 200);
    const updatedBody = await updated.json() as Record<string, unknown>;
    assert.equal(updatedBody.status, "Inactive");
    assert.equal(updatedBody.chargeType, "fixed");
    assert.equal(updatedBody.chargeValue, 25);
    assert.equal(scheme?.status, "Inactive");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (originalExecute) Object.defineProperty(database, "execute", originalExecute);
    else Reflect.deleteProperty(database, "execute");
  }
});
