import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

test("customer SIP enrollment requires approved KYC and stores a charged installment schedule", async () => {
  process.env.JWT_SECRET ??= "customer-sip-test-secret-with-at-least-32-bytes";
  process.env.DB_USER ??= "customer-sip-test";
  process.env.DB_NAME ??= "customer_sip_test";
  const [{ default: express }, { default: database }, { default: customerActivityRouter }, tokens] =
    await Promise.all([
      import("express"),
      import("../src/config/database"),
      import("../src/modules/customer-activity/routes"),
      import("../src/modules/customer-auth/tokens"),
    ]);

  const token = tokens.createCustomerToken(51, "+919876543210");
  const tokenHash = tokens.hashCustomerToken(token);
  let kycStatus: "PENDING" | "VERIFIED" = "PENDING";
  let connectionCount = 0;
  let enrollment: Record<string, unknown> | null = null;
  let insertedEnrollmentValues: unknown[] = [];
  const installments: Array<Record<string, unknown>> = [];
  const originalExecute = Object.getOwnPropertyDescriptor(database, "execute");
  const originalGetConnection = Object.getOwnPropertyDescriptor(database, "getConnection");

  Object.defineProperty(database, "execute", {
    configurable: true,
    value: async (sql: string, values: unknown[] = []) => {
      if (sql.includes("FROM customer_auth_sessions")) {
        return Buffer.isBuffer(values[0]) && values[0].equals(tokenHash)
          ? [[{
            user_id: 51,
            full_name: "Test SIP Customer",
            mobile: "+919876543210",
            email: "sip@example.com",
            verification_status: kycStatus,
          }], []]
          : [[], []];
      }
      if (sql.includes("FROM sip_schemes s") && sql.includes("UPPER(TRIM(s.status)) = 'ACTIVE'")) {
        assert.match(sql, /UPPER\(TRIM\(p\.status\)\) = 'ACTIVE'/);
        return [[{
          scheme_id: "SCHEME-1",
          scheme_name: "Gold Monthly",
          product_id: "GOLD-24K",
          metal: "Gold",
          purity: "24K",
          minimum_amount: "1000.00",
          frequency: "Monthly",
          duration_months: 2,
          charge_type: "percentage",
          charge_value: "2.50",
          tax_rate_bps: 1800,
          status: "Active",
        }], []];
      }
      if (sql.includes("FROM customer_sip_plans p") && sql.includes("p.customer_user_id IS NULL")) {
        assert.match(sql, /UPPER\(TRIM\(p\.status\)\) = 'ACTIVE'/);
        assert.match(sql, /UPPER\(TRIM\(m\.status\)\) = 'ACTIVE'/);
        return [[{
          sip_id: "SIP-ADMIN-1",
          product_id: "GOLD-24K",
          metal: "Gold",
          purity: "24K",
          monthly_amount: "500.00",
          duration_months: 12,
          shop_owner_monthly_contribution: "100.00",
          shop_owner_contribution_months: 6,
          total_shop_owner_contribution: "600.00",
          total_customer_payments: "6000.00",
          total_investment: "6600.00",
          status: "Active",
        }], []];
      }
      throw new Error(`Unexpected pool query: ${sql}`);
    },
  });
  Object.defineProperty(database, "getConnection", {
    configurable: true,
    value: async () => {
      connectionCount += 1;
      return {
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        execute: async (sql: string, values: unknown[] = []) => {
          if (sql.includes("FROM sip_schemes s") && sql.includes("FOR UPDATE")) {
            return [[{
              scheme_id: "SCHEME-1",
              scheme_name: "Gold Monthly",
              product_id: "GOLD-24K",
              minimum_amount: "1000.00",
              frequency: "Monthly",
              duration_months: 2,
              charge_type: "percentage",
              charge_value: "2.50",
              tax_rate_bps: 1800,
            }], []];
          }
          if (sql.includes("INSERT INTO customer_sip_enrollments")) {
            insertedEnrollmentValues = values;
            enrollment = {
              enrollment_id: values[0],
              customer_user_id: values[1],
              scheme_id: values[2],
              scheme_name: values[4],
              product_id: values[3],
              frequency: values[5],
              duration_months: values[6],
              installment_amount: values[7],
              installment_count: values[8],
              total_customer_payments: values[9],
              charge_type: values[10],
              charge_value: values[11],
              total_charges: values[13],
              tax_rate_bps: values[14],
              total_taxes: values[16],
              total_investment: values[17],
              status: "Active",
              start_date: values[18],
              maturity_date: values[19],
              next_due_date: values[20],
              created_at: "2026-01-01 00:00:00",
              metal: "Gold",
              purity: "24K",
            };
            return [{ affectedRows: 1 }, []];
          }
          if (sql.includes("INSERT INTO customer_sip_enrollment_installments")) {
            installments.push({
              enrollment_id: values[0],
              installment_number: values[1],
              due_date: values[2],
              amount: values[3],
              charge_amount: values[4],
              tax_amount: values[5],
              payment_status: "PENDING",
              paid_at: null,
              skipped_at: null,
            });
            return [{ affectedRows: 1 }, []];
          }
          if (sql.includes("FROM customer_sip_enrollments e")) return [[enrollment].filter(Boolean), []];
          if (sql.includes("FROM customer_sip_enrollment_installments")) return [installments, []];
          throw new Error(`Unexpected connection query: ${sql}`);
        },
      };
    },
  });

  const app = express();
  app.use(express.json());
  app.use("/api/customer", customerActivityRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  const endpoint = `http://127.0.0.1:${address.port}/api/customer/sips`;
  const schemesEndpoint = `http://127.0.0.1:${address.port}/api/customer/sip-schemes`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    const schemesResponse = await fetch(schemesEndpoint, { headers });
    assert.equal(schemesResponse.status, 200);
    const schemesBody = await schemesResponse.json() as { schemes: Array<Record<string, unknown>> };
    const configuredScheme = schemesBody.schemes.find((scheme) => scheme.id === "SCHEME-1");
    const adminPlan = schemesBody.schemes.find((scheme) => scheme.id === "SIP-ADMIN-1");
    assert.ok(configuredScheme);
    assert.equal(configuredScheme.estimatedInstallmentCharge, 25);
    assert.equal(configuredScheme.estimatedInstallmentTax, 4.5);
    assert.equal(configuredScheme.estimatedInstallmentTotal, 1029.5);
    assert.ok(adminPlan);
    assert.equal(adminPlan.name, "Gold SIP");
    assert.equal(adminPlan.minimumAmount, 500);
    assert.equal(adminPlan.durationMonths, 18);
    assert.equal(adminPlan.estimatedInstallmentCharge, 500);
    assert.equal(adminPlan.estimatedInstallmentTotal, 6600);
    assert.equal(adminPlan.chargeValue, 500);
    assert.equal(adminPlan.totalInvestment, 6600);
    assert.equal(adminPlan.source, "admin-plan");

    const pendingResponse = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ schemeId: "SCHEME-1", termsAccepted: true }),
    });
    assert.equal(pendingResponse.status, 403);
    assert.equal(connectionCount, 0);

    kycStatus = "VERIFIED";
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        schemeId: "SCHEME-1",
        monthlyAmount: 1500,
        durationMonths: 3,
        termsAccepted: true,
      }),
    });
    assert.equal(response.status, 201);
    const body = await response.json() as { enrollment: Record<string, unknown> };
    assert.equal(body.enrollment.installmentAmount, 1500);
    assert.equal(body.enrollment.durationMonths, 3);
    assert.equal(body.enrollment.schemeId, "SCHEME-1");
    assert.equal(body.enrollment.status, "Active");
    assert.equal(body.enrollment.startDate, insertedEnrollmentValues[18]);
    assert.equal(body.enrollment.maturityDate, insertedEnrollmentValues[19]);
    assert.equal(body.enrollment.installmentCount, 3);
    assert.equal(body.enrollment.totalCustomerPayments, 4500);
    assert.equal(body.enrollment.totalCharges, 112.5);
    assert.equal(body.enrollment.totalTaxes, 20.25);
    assert.equal(body.enrollment.totalInvestment, 4632.75);
    assert.equal((body.enrollment.installments as Array<Record<string, unknown>>).length, 3);
    assert.equal(installments[0].amount, "1500.00");
    assert.equal(installments[0].charge_amount, "37.50");
    assert.equal(installments[0].tax_amount, "6.75");
    assert.equal(insertedEnrollmentValues[1], 51);
    assert.equal(insertedEnrollmentValues[2], "SCHEME-1");
    assert.equal(insertedEnrollmentValues[6], 3);
    assert.equal(insertedEnrollmentValues[7], "1500.00");

    const belowMinimumResponse = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        schemeId: "SCHEME-1",
        monthlyAmount: 999,
        durationMonths: 3,
        termsAccepted: true,
      }),
    });
    assert.equal(belowMinimumResponse.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (originalExecute) Object.defineProperty(database, "execute", originalExecute);
    else Reflect.deleteProperty(database, "execute");
    if (originalGetConnection) Object.defineProperty(database, "getConnection", originalGetConnection);
    else Reflect.deleteProperty(database, "getConnection");
  }
});
