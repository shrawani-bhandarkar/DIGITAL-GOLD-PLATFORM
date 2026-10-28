import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

test("admin SIP plans persist monthly schedules and extend maturity after skipped installments", async () => {
  process.env.JWT_SECRET ??= "admin-sip-test-secret-with-at-least-32-bytes";
  process.env.DB_USER ??= "admin-sip-test";
  process.env.DB_NAME ??= "admin_sip_test";
  const [{ default: express }, { default: database }, { default: adminConsoleRouter }, tokens] =
    await Promise.all([
      import("express"),
      import("../src/config/database"),
      import("../src/modules/admin-console/routes"),
      import("../src/modules/auth/tokens"),
    ]);

  let sipId = "SIP-test";
  const startDate = new Date().toISOString().slice(0, 10);
  const addMonth = (date: string, months: number): string => {
    const [year, month, day] = date.split("-").map(Number);
    const targetMonth = month - 1 + months;
    const targetYear = year + Math.floor(targetMonth / 12);
    const monthIndex = targetMonth % 12;
    const lastDay = new Date(Date.UTC(targetYear, monthIndex + 1, 0)).getUTCDate();
    return new Date(Date.UTC(targetYear, monthIndex, Math.min(day, lastDay))).toISOString().slice(0, 10);
  };
  const plan = {
    sip_id: sipId,
    customer_user_id: null as number | null,
    customer_name: null as string | null,
    product_id: "GOLD_24K",
    metal: "Gold",
    purity: "24K",
    shop_owner_monthly_contribution: "200.00",
    shop_owner_contribution_months: 3,
    total_shop_owner_contribution: "600.00",
    monthly_amount: "500.00",
    duration_months: 2,
    total_customer_payments: "1000.00",
    total_investment: "1600.00",
    start_date: startDate,
    maturity_date: addMonth(startDate, 4),
    next_due_date: addMonth(startDate, 3) as string | null,
    status: "Active",
    created_at: "2026-10-27 08:00:00",
  };
  const installments: Array<{
    installment_id: number;
    installment_number: number;
    due_date: string;
    amount: string;
    payment_status: "PENDING" | "PAID" | "SKIPPED";
    paid_at: string | null;
    skipped_at: string | null;
  }> = [];
  let nextInstallmentId = 1;
  const originalExecute = Object.getOwnPropertyDescriptor(database, "execute");
  const originalGetConnection = Object.getOwnPropertyDescriptor(database, "getConnection");

  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql: string, values: unknown[] = []) => {
      if (sql.includes("FROM admin_metal_products") && sql.includes("status IN")) {
        return [[{ product_id: "GOLD_24K" }], []];
      }
      if (sql.includes("FROM customer_sip_plans WHERE sip_id = ? FOR UPDATE") && sql.includes("duration_months")) {
        return [[{
          duration_months: plan.duration_months,
          monthly_amount: plan.monthly_amount,
          maturity_date: plan.maturity_date,
          status: plan.status,
        }], []];
      }
      if (sql.includes("SELECT installment_id, installment_number, due_date")
        && sql.includes("payment_status = 'PENDING'")) {
        const pending = installments
          .filter((installment) => installment.payment_status === "PENDING")
          .sort((left, right) => left.due_date.localeCompare(right.due_date))[0];
        return [pending ? [{
          installment_id: pending.installment_id,
          installment_number: pending.installment_number,
          due_date: pending.due_date,
        }] : [], []];
      }
      if (sql.includes("MAX(installment_number)")) {
        return [[{ last_number: Math.max(0, ...installments.map((installment) => installment.installment_number)) }], []];
      }
      if (sql.includes("SELECT SUM(payment_status = 'PAID')") && sql.includes("FROM customer_sip_installments WHERE sip_id = ?")) {
        const pending = installments
          .filter((installment) => installment.payment_status === "PENDING")
          .sort((left, right) => left.due_date.localeCompare(right.due_date))[0];
        return [[{
          paid_count: installments.filter((installment) => installment.payment_status === "PAID").length,
          next_due_date: pending?.due_date ?? null,
        }], []];
      }
      if (sql.includes("SELECT installment_id, installment_number,") && sql.includes("ORDER BY installment_number")) {
        return [installments.map((installment) => ({ ...installment })), []];
      }
      if (sql.includes("SELECT p.sip_id AS id")) {
        return [[{
          id: plan.sip_id,
          customer_user_id: plan.customer_user_id,
          customer_name: plan.customer_name,
          product_id: plan.product_id,
          metal: plan.metal,
          purity: plan.purity,
          shop_owner_monthly_contribution: plan.shop_owner_monthly_contribution,
          shop_owner_contribution_months: plan.shop_owner_contribution_months,
          total_shop_owner_contribution: plan.total_shop_owner_contribution,
          monthly_amount: plan.monthly_amount,
          duration_months: plan.duration_months,
          total_customer_payments: plan.total_customer_payments,
          total_investment: plan.total_investment,
          start_date: plan.start_date,
          maturity_date: plan.maturity_date,
          next_due_date: plan.next_due_date,
          status: plan.status,
          created_at: plan.created_at,
          paid_count: installments.filter((item) => item.payment_status === "PAID").length,
          pending_count: installments.filter((item) => item.payment_status === "PENDING").length,
          skipped_count: installments.filter((item) => item.payment_status === "SKIPPED").length,
        }], []];
      }
      if (sql.includes("INSERT INTO customer_sip_plans")) {
        assert.match(sql, /VALUES\s*\(\?,\s*NULL,/);
        assert.equal(values.length, 12);
        sipId = String(values[0]);
        plan.sip_id = sipId;
        Object.assign(plan, {
          customer_user_id: null,
          product_id: values[1],
          shop_owner_monthly_contribution: values[2],
          shop_owner_contribution_months: values[3],
          total_shop_owner_contribution: values[4],
          monthly_amount: values[5],
          duration_months: values[6],
          total_customer_payments: values[7],
          total_investment: values[8],
          start_date: values[9],
          maturity_date: values[10],
          next_due_date: values[11],
        });
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("INSERT INTO customer_sip_installments")) {
        installments.push({
          installment_id: nextInstallmentId++,
          sip_id: String(values[0]),
          installment_number: Number(values[1]),
          due_date: String(values[2]),
          amount: String(values[3]),
          payment_status: "PENDING",
          paid_at: null,
          skipped_at: null,
        } as typeof installments[number]);
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE customer_sip_installments SET payment_status = 'SKIPPED'")) {
        const installment = installments.find((item) => item.installment_id === Number(values[0]));
        assert.ok(installment);
        installment.payment_status = "SKIPPED";
        installment.skipped_at = "2026-10-27 08:00:00";
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE customer_sip_installments SET payment_status = 'PAID'")) {
        const installment = installments.find((item) => item.installment_id === Number(values[0]));
        assert.ok(installment);
        installment.payment_status = "PAID";
        installment.paid_at = "2026-10-27 08:00:00";
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE customer_sip_plans SET maturity_date = ?")) {
        plan.maturity_date = String(values[0]);
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE customer_sip_plans SET next_due_date = ?")) {
        plan.next_due_date = values[0] === null ? null : String(values[0]);
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("UPDATE customer_sip_plans SET status = 'Completed'")) {
        plan.status = "Completed";
        plan.next_due_date = null;
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected SIP database query: ${sql}`);
    },
  };

  Object.defineProperty(database, "execute", {
    configurable: true,
    value: async (sql: string, values: unknown[] = []) => {
      if (sql.includes("FROM superadmin_jwt_sessions")) return [[{ id: 1, email: "owner@example.test" }], []];
      throw new Error(`Unexpected SIP database query: ${sql}`);
    },
  });
  Object.defineProperty(database, "getConnection", {
    configurable: true,
    value: async () => connection,
  });

  const app = express();
  app.use(express.json());
  app.use("/api/admin/console", adminConsoleRouter);
  const server = app.listen(0, "127.0.0.1");
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
    const headers = {
      "Content-Type": "application/json",
      Cookie: `dg_admin_session=${token}`,
    };
    const created = await fetch(`http://127.0.0.1:${address.port}/api/admin/console/sips`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        productId: "GOLD_24K",
        contributionMonthlyAmount: "200",
        contributionDurationMonths: 3,
        monthlyAmount: "500",
        durationMonths: 2,
      }),
    });
    assert.equal(created.status, 201);
    const createdResult = await created.json();
    assert.equal(createdResult.sip.customer, null);
    assert.equal(createdResult.sip.customerId, null);
    assert.equal(createdResult.sip.monthlyContribution, 200);
    assert.equal(createdResult.sip.contributionDurationMonths, 3);
    assert.equal(createdResult.sip.totalShopOwnerContribution, 600);
    assert.equal(createdResult.sip.totalCustomerPayments, 1000);
    assert.equal(createdResult.sip.totalInvestment, 1600);
    assert.equal(plan.customer_user_id, null);
    assert.equal(plan.shop_owner_monthly_contribution, "200.00");
    assert.equal(plan.shop_owner_contribution_months, 3);
    assert.equal(plan.total_shop_owner_contribution, "600.00");
    assert.equal(plan.total_customer_payments, "1000.00");
    assert.equal(plan.total_investment, "1600.00");
    assert.equal(plan.duration_months, 2);
    assert.equal(plan.start_date, startDate);
    assert.equal(plan.next_due_date, addMonth(startDate, 3));
    assert.equal(plan.maturity_date, addMonth(startDate, 4));
    assert.deepEqual(installments.map(({ installment_number, due_date }) => [installment_number, due_date]), [
      [1, addMonth(startDate, 3)],
      [2, addMonth(startDate, 4)],
    ]);

    const skipped = await fetch(`http://127.0.0.1:${address.port}/api/admin/console/sips/${sipId}/installments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "skip" }),
    });
    assert.equal(skipped.status, 200);
    await skipped.json();
    assert.equal(plan.maturity_date, addMonth(startDate, 5));
    assert.equal(plan.next_due_date, addMonth(startDate, 4));
    assert.equal(installments[0].payment_status, "SKIPPED");
    assert.equal(installments[2].due_date, addMonth(startDate, 5));

    const paid = await fetch(`http://127.0.0.1:${address.port}/api/admin/console/sips/${sipId}/installments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "paid" }),
    });
    assert.equal(paid.status, 200);
    await paid.json();
    assert.equal(installments[1].payment_status, "PAID");
    assert.equal(plan.next_due_date, addMonth(startDate, 5));
  } finally {
    if (originalExecute) Object.defineProperty(database, "execute", originalExecute);
    else delete (database as { execute?: unknown }).execute;
    if (originalGetConnection) Object.defineProperty(database, "getConnection", originalGetConnection);
    else delete (database as { getConnection?: unknown }).getConnection;
    server.close();
    await once(server, "close");
  }
});
