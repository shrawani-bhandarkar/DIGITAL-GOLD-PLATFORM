import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

test("Superadmin metal-price updates persist and are returned by the public rates API", async () => {
  process.env.JWT_SECRET ??= "metal-price-test-secret-with-at-least-32-bytes";
  process.env.DB_USER ??= "metal-price-test";
  process.env.DB_NAME ??= "metal_price_test";
  const [{ default: express }, { default: database }, { default: adminRouter }, { default: marketRatesRouter }, tokens] =
    await Promise.all([
      import("express"),
      import("../src/config/database"),
      import("../src/modules/metal-prices/routes"),
      import("../src/modules/rates/routes"),
      import("../src/modules/auth/tokens"),
    ]);
  const app = express();
  app.use(express.json());
  app.use("/api/admin/metal-prices", adminRouter);
  app.use("/api/market", marketRatesRouter);

  const storedRate = {
    rate_id: 17,
    metal_type: "Gold",
    rate_per_gram: "7900.0000",
    purity: "24K",
    effective_date: "2026-10-24",
    updated_at: "2026-10-24 05:00:00",
  };
  const inserts: unknown[][] = [];
  const originalExecute = Object.getOwnPropertyDescriptor(database, "execute");
  Object.defineProperty(database, "execute", {
    configurable: true,
    value: async (sql: string, values: unknown[] = []) => {
      if (sql.includes("FROM superadmin_jwt_sessions")) {
        return [[{ id: 1, email: "owner@example.test" }], []];
      }
      if (sql.includes("FROM admin_jwt_sessions")) {
        return [[{ id: 2, email: "admin@example.test", role: "ADMIN" }], []];
      }
      if (sql.includes("INSERT INTO admin_metal_price_history")) {
        inserts.push(values);
        return [{ insertId: storedRate.rate_id, affectedRows: 1 }, []];
      }
      if (sql.includes("WHERE rate_id = ?")) return [[storedRate], []];
      if (sql.includes("FROM admin_metal_price_history")) return [[storedRate], []];
      throw new Error(`Unexpected database query: ${sql}`);
    },
  });

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  const apiBase = `http://127.0.0.1:${address.port}`;
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
  });

  try {
    const saveResponse = await fetch(`${apiBase}/api/admin/metal-prices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `dg_admin_session=${superAdminToken}`,
      },
      body: JSON.stringify({
        metalType: "Gold",
        ratePerGram: 7900,
        purity: "24K",
        effectiveDate: "2026-10-24",
      }),
    });
    assert.equal(saveResponse.status, 201);
    assert.deepEqual(inserts, [["Gold", 7900, "24K", "2026-10-24"]]);

    const ratesResponse = await fetch(`${apiBase}/api/market/rates`);
    assert.equal(ratesResponse.status, 200);
    assert.deepEqual(await ratesResponse.json(), {
      rates: [{
        metalId: "gold",
        metal: "Gold",
        purity: "24K",
        ratePerGram: 7900,
        effectiveDate: "2026-10-24",
        updatedAt: "2026-10-24 05:00:00",
      }],
    });

    const deniedResponse = await fetch(`${apiBase}/api/admin/metal-prices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `dg_admin_session=${adminToken}`,
      },
      body: JSON.stringify({
        metalType: "Gold",
        ratePerGram: 8000,
        purity: "24K",
        effectiveDate: "2026-10-24",
      }),
    });
    assert.equal(deniedResponse.status, 403);
    assert.equal(inserts.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    if (originalExecute) Object.defineProperty(database, "execute", originalExecute);
    else Reflect.deleteProperty(database, "execute");
  }
});
