import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

test("customer Quick Buy quotes and persists one pending order/payment per idempotency key", async () => {
  process.env.JWT_SECRET ??= "customer-orders-test-secret-with-at-least-32-bytes";
  process.env.DB_USER ??= "customer-orders-test";
  process.env.DB_NAME ??= "customer_orders_test";
  const [{ default: express }, { default: database }, { default: customerOrdersRouter }, tokens] =
    await Promise.all([
      import("express"),
      import("../src/config/database"),
      import("../src/modules/customer-orders/routes"),
      import("../src/modules/customer-auth/tokens"),
    ]);

  const orders: Array<{ id: string; status: string; data: Record<string, unknown> }> = [];
  const payments: Array<{ id: string; orderId: string; status: string; data: Record<string, unknown> }> = [];
  let stagedOrder: typeof orders[number] | null = null;
  let stagedPayment: typeof payments[number] | null = null;
  let failPaymentInsert = false;
  let rollbackCount = 0;
  let loggedWriteError = false;
  let taxSettingsConfigured = true;
  let chargePerPurchase = "25.00";
  let makingChargeEnabled = true;
  let rateUpdatedAt = "2026-04-12 09:00:00";
  let activeMetal: "Gold" | "Silver" | "Platinum" = "Gold";
  const ratesPerGram = { Gold: "12500.0000", Silver: "180.0000", Platinum: "4200.0000" };
  const originalConsoleError = console.error;
  const connection = {
    beginTransaction: async () => { stagedOrder = null; stagedPayment = null; },
    commit: async () => {
      if (stagedOrder) orders.push(stagedOrder);
      if (stagedPayment) payments.push(stagedPayment);
      stagedOrder = null;
      stagedPayment = null;
    },
    rollback: async () => {
      rollbackCount += 1;
      stagedOrder = null;
      stagedPayment = null;
    },
    release: () => {},
    execute: async (sql: string, values: unknown[] = []) => {
      if (sql.includes("FROM admin_metal_products")) {
        return [[{
          product_id: `${activeMetal.toUpperCase()}_TEST`,
          name: `${activeMetal} test`,
          metal: activeMetal,
          purity: activeMetal === "Gold" ? "24K (999)" : "Test purity",
          status: "ACTIVE",
          product_data: "{}",
          updated_at: "2026-04-12 08:00:00",
        }], []];
      }
      if (sql.includes("FROM admin_metal_price_history")) {
        return [[{
          rate_id: 42,
          metal_type: activeMetal,
          rate_per_gram: ratesPerGram[activeMetal],
          purity: activeMetal === "Gold" ? "24K (999)" : "Test purity",
          effective_date: "2026-04-12",
          updated_at: rateUpdatedAt,
        }], []];
      }
      if (sql.includes("FROM admin_metal_making_charges")) {
        return [[{ charge_per_purchase: chargePerPurchase, enabled: Number(makingChargeEnabled), updated_at: "2026-04-12 08:30:00" }], []];
      }
      if (sql.includes("FROM admin_metal_gst_settings")) {
        return [taxSettingsConfigured ? [{
          seller_state_code: "MH",
          cgst_bps: 150,
          sgst_bps: 150,
          igst_bps: 300,
          updated_at: "2026-04-12 08:45:00",
        }] : [], []];
      }
      if (sql.includes("FROM users WHERE user_id = ? AND status = 'ACTIVE'")) {
        return [[{ user_id: 7 }], []];
      }
      if (sql.includes("FROM admin_orders") && sql.includes("JSON_EXTRACT")) {
        const found = orders.find((order) => order.data.idempotencyKey === values[1]);
        return [found ? [{ order_id: found.id, status: found.status, record_data: found.data }] : [], []];
      }
      if (sql.includes("INSERT INTO admin_orders")) {
        stagedOrder = {
          id: String(values[0]),
          status: "Pending",
          data: JSON.parse(String(values[5])) as Record<string, unknown>,
        };
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("INSERT INTO admin_payments")) {
        if (failPaymentInsert) throw new Error("Simulated payment insert failure.");
        stagedPayment = {
          id: String(values[0]),
          orderId: String(values[1]),
          status: "Pending",
          data: JSON.parse(String(values[3])) as Record<string, unknown>,
        };
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("FROM admin_payments WHERE order_id = ?")) {
        const payment = payments.find((item) => item.orderId === values[0]);
        return [payment ? [{ payment_id: payment.id, status: payment.status, record_data: payment.data }] : [], []];
      }
      throw new Error(`Unexpected customer purchase query: ${sql}`);
    },
  };

  const poolConnection = connection as unknown as Awaited<ReturnType<typeof database.getConnection>>;
  const originalExecute = Object.getOwnPropertyDescriptor(database, "execute");
  const originalGetConnection = Object.getOwnPropertyDescriptor(database, "getConnection");
  Object.defineProperty(database, "execute", {
    configurable: true,
    value: async (sql: string) => {
      if (sql.includes("FROM customer_auth_sessions")) {
        return [[{ user_id: 7, full_name: "Test Customer", mobile: "+919876543210" }], []];
      }
      throw new Error(`Unexpected database query: ${sql}`);
    },
  });
  Object.defineProperty(database, "getConnection", {
    configurable: true,
    value: async () => poolConnection,
  });
  console.error = (...args: Parameters<typeof console.error>) => {
    if (args[0] === "create customer purchase failed:") {
      loggedWriteError = true;
      return;
    }
    originalConsoleError(...args);
  };

  const app = express();
  app.use(express.json());
  app.use("/api/customer/orders", customerOrdersRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  const apiBase = `http://127.0.0.1:${address.port}`;
  const token = tokens.createCustomerToken(7, "+919876543210");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const purchase = { metalId: "gold", mode: "amount", value: "1000" };
  const key = "quickbuy-test-key-123456";

  try {
    const unauthenticated = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(purchase),
    });
    assert.equal(unauthenticated.status, 401);

    taxSettingsConfigured = false;
    const missingTaxSettingsResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
      method: "POST",
      headers,
      body: JSON.stringify(purchase),
    });
    assert.equal(missingTaxSettingsResponse.status, 503);
    taxSettingsConfigured = true;

    const quoteResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
      method: "POST",
      headers,
      body: JSON.stringify(purchase),
    });
    assert.equal(quoteResponse.status, 200);
    assert.equal(quoteResponse.headers.get("cache-control"), "no-store");
    const quoteResult = await quoteResponse.json();
    const quote = quoteResult.quote;
    assert.equal(typeof quote.quoteToken, "string");
    const { quoteToken: _quoteToken, ...quoteDetails } = quote;
    assert.deepEqual(quoteDetails, {
      metalId: "gold",
      metal: "Gold",
      purity: "24K (999)",
      ratePerGram: 12500,
      effectiveDate: "2026-04-12",
      rateUpdatedAt: "2026-04-12 09:00:00",
      mode: "amount",
      inputValue: "1000",
      quantityGrams: 0.08,
      metalValue: 1000,
      makingChargePerPurchase: 25,
      makingChargeEnabled: true,
      makingChargeConfigured: true,
      makingCharges: 25,
      purchaseSubtotal: 1025,
      charges: 0,
      chargesConfigured: false,
      taxes: 30.76,
      taxesConfigured: true,
      taxJurisdiction: "intra-state",
      customerStateCode: "MH",
      sellerStateCode: "MH",
      taxBreakdown: {
        taxableAmount: 1025,
        cgst: 15.38,
        sgst: 15.38,
        igst: 0,
        total: 30.76,
        ratesBps: { cgst: 150, sgst: 150, igst: 300 },
      },
      totalAmount: 1055.76,
      currency: "INR",
    });

    for (const metal of ["Silver", "Platinum"] as const) {
      activeMetal = metal;
      const amountQuoteResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
        method: "POST",
        headers,
        body: JSON.stringify({ metalId: metal.toLowerCase(), mode: "amount", value: "1234.56" }),
      });
      assert.equal(amountQuoteResponse.status, 200);
      const amountQuote = (await amountQuoteResponse.json()).quote;
      assert.equal(amountQuote.inputValue, "1234.56");
      assert.equal(amountQuote.metalValue, 1234.56);
      assert.ok(amountQuote.quantityGrams > 0);
      assert.equal(Number(amountQuote.quantityGrams.toFixed(6)), amountQuote.quantityGrams);
      assert.ok(amountQuote.makingCharges > 0);
      assert.equal(
        amountQuote.taxBreakdown.taxableAmount,
        Number((amountQuote.metalValue + amountQuote.makingCharges + amountQuote.charges).toFixed(2)),
      );
      assert.equal(
        amountQuote.totalAmount,
        Number((amountQuote.taxBreakdown.taxableAmount + amountQuote.taxBreakdown.total).toFixed(2)),
      );
      assert.equal(amountQuote.taxBreakdown.cgst, amountQuote.taxBreakdown.sgst);

      const initialMakingCharges = amountQuote.makingCharges;
      chargePerPurchase = "75.00";
      const refreshedQuoteResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
        method: "POST",
        headers,
        body: JSON.stringify({ metalId: metal.toLowerCase(), mode: "amount", value: "1234.56" }),
      });
      assert.equal(refreshedQuoteResponse.status, 200);
      const refreshedQuote = (await refreshedQuoteResponse.json()).quote;
      assert.equal(refreshedQuote.makingChargePerPurchase, 75);
      assert.notEqual(refreshedQuote.makingCharges, initialMakingCharges);
      assert.equal(refreshedQuote.makingCharges, 75);
      assert.notEqual(refreshedQuote.quoteToken, amountQuote.quoteToken);
      assert.equal(refreshedQuote.taxBreakdown.taxableAmount, Number((refreshedQuote.metalValue + refreshedQuote.makingCharges + refreshedQuote.charges).toFixed(2)));
      assert.equal(refreshedQuote.taxBreakdown.cgst, refreshedQuote.taxBreakdown.sgst);
      assert.equal(refreshedQuote.makingCharges, 75);

      const secondAmountResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
        method: "POST",
        headers,
        body: JSON.stringify({ metalId: metal.toLowerCase(), mode: "amount", value: "5000" }),
      });
      assert.equal(secondAmountResponse.status, 200);
      const secondAmountQuote = (await secondAmountResponse.json()).quote;
      assert.equal(secondAmountQuote.inputValue, "5000");
      assert.equal(secondAmountQuote.makingChargePerPurchase, 75);
      assert.equal(secondAmountQuote.makingCharges, refreshedQuote.makingCharges);
      assert.notEqual(secondAmountQuote.quantityGrams, refreshedQuote.quantityGrams);
      assert.equal(secondAmountQuote.taxBreakdown.cgst, secondAmountQuote.taxBreakdown.sgst);

      const gramsQuoteResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
        method: "POST",
        headers,
        body: JSON.stringify({ metalId: metal.toLowerCase(), mode: "grams", value: "2.5" }),
      });
      assert.equal(gramsQuoteResponse.status, 200);
      const gramsQuote = (await gramsQuoteResponse.json()).quote;
      assert.equal(gramsQuote.mode, "grams");
      assert.equal(gramsQuote.quantityGrams, 2.5);
      assert.equal(gramsQuote.makingChargePerPurchase, refreshedQuote.makingChargePerPurchase);
      assert.equal(gramsQuote.makingCharges, 75);
      assert.equal(
        gramsQuote.taxBreakdown.taxableAmount,
        Number((gramsQuote.metalValue + gramsQuote.makingCharges + gramsQuote.charges).toFixed(2)),
      );
      assert.equal(gramsQuote.taxBreakdown.cgst, gramsQuote.taxBreakdown.sgst);
      assert.equal(
        gramsQuote.totalAmount,
        Number((gramsQuote.taxBreakdown.taxableAmount + gramsQuote.taxBreakdown.total).toFixed(2)),
      );
      chargePerPurchase = "25.00";
    }
    activeMetal = "Gold";
    const goldAmountResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ metalId: "gold", mode: "amount", value: "1001" }),
    });
    assert.equal(goldAmountResponse.status, 200);
    const goldAmountQuote = (await goldAmountResponse.json()).quote;
    assert.equal(goldAmountQuote.inputValue, "1001");
    assert.equal(goldAmountQuote.metalValue, 1000);

    const quantityQuoteResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ metalId: "gold", mode: "grams", value: "1.000" }),
    });
    assert.equal(quantityQuoteResponse.status, 200);
    const quantityQuote = (await quantityQuoteResponse.json()).quote;
    assert.equal(quantityQuote.quantityGrams, 1);
    assert.equal(quantityQuote.metalValue, 12500);
    assert.equal(quantityQuote.makingCharges, 25);
    assert.equal(quantityQuote.taxBreakdown.cgst, 187.88);
    assert.equal(quantityQuote.taxBreakdown.sgst, 187.88);
    assert.equal(quantityQuote.totalAmount, 12900.76);

    chargePerPurchase = "50.00";
    const updatedAmountQuoteResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ metalId: "gold", mode: "amount", value: "1000" }),
    });
    assert.equal(updatedAmountQuoteResponse.status, 200);
    const updatedAmountQuote = (await updatedAmountQuoteResponse.json()).quote;
    assert.equal(updatedAmountQuote.makingChargePerPurchase, 50);
    assert.equal(updatedAmountQuote.makingCharges, 50);

    const updatedQuantityQuoteResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ metalId: "gold", mode: "grams", value: "1.000" }),
    });
    assert.equal(updatedQuantityQuoteResponse.status, 200);
    const updatedQuantityQuote = (await updatedQuantityQuoteResponse.json()).quote;
    assert.equal(updatedQuantityQuote.makingChargePerPurchase, 50);
    assert.equal(updatedQuantityQuote.makingCharges, 50);
    chargePerPurchase = "25.00";

    chargePerPurchase = "400.00";
    for (const input of [
      { mode: "amount", value: "1000" },
      { mode: "grams", value: "1.000" },
    ]) {
      const chargeQuoteResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
        method: "POST",
        headers,
        body: JSON.stringify({ metalId: "gold", ...input }),
      });
      assert.equal(chargeQuoteResponse.status, 200);
      const chargeQuote = (await chargeQuoteResponse.json()).quote;
      assert.equal(chargeQuote.makingChargePerPurchase, 400);
      assert.equal(chargeQuote.makingCharges, 400);
      assert.equal(chargeQuote.taxBreakdown.taxableAmount, Number((chargeQuote.metalValue + 400 + chargeQuote.charges).toFixed(2)));
      assert.equal(chargeQuote.taxBreakdown.cgst, chargeQuote.taxBreakdown.sgst);
    }
    chargePerPurchase = "25.00";

    chargePerPurchase = "400.00";
    makingChargeEnabled = false;
    for (const input of [
      { mode: "amount", value: "1000" },
      { mode: "grams", value: "1.000" },
    ]) {
      const disabledChargeResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
        method: "POST",
        headers,
        body: JSON.stringify({ metalId: "silver", ...input }),
      });
      assert.equal(disabledChargeResponse.status, 200);
      const disabledChargeQuote = (await disabledChargeResponse.json()).quote;
      assert.equal(disabledChargeQuote.makingChargeConfigured, true);
      assert.equal(disabledChargeQuote.makingChargeEnabled, false);
      assert.equal(disabledChargeQuote.makingChargePerPurchase, 400);
      assert.equal(disabledChargeQuote.makingCharges, 400);
      assert.equal(
        disabledChargeQuote.taxBreakdown.taxableAmount,
        Number((disabledChargeQuote.metalValue + 400 + disabledChargeQuote.charges).toFixed(2)),
      );
      assert.equal(
        disabledChargeQuote.totalAmount,
        Number((disabledChargeQuote.taxBreakdown.taxableAmount + disabledChargeQuote.taxBreakdown.total).toFixed(2)),
      );
      assert.equal(disabledChargeQuote.taxBreakdown.cgst, disabledChargeQuote.taxBreakdown.sgst);
    }
    makingChargeEnabled = true;
    chargePerPurchase = "25.00";

    const interstateQuoteResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ metalId: "gold", mode: "grams", value: "1.000", stateCode: "KA" }),
    });
    assert.equal(interstateQuoteResponse.status, 200);
    const interstateQuote = (await interstateQuoteResponse.json()).quote;
    assert.equal(interstateQuote.taxJurisdiction, "inter-state");
    assert.equal(interstateQuote.taxBreakdown.cgst, 0);
    assert.equal(interstateQuote.taxBreakdown.sgst, 0);
    assert.equal(interstateQuote.taxBreakdown.igst, 375.75);

    const invalidQuantityResponse = await fetch(`${apiBase}/api/customer/orders/purchase/quote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ metalId: "gold", mode: "grams", value: "1.0001" }),
    });
    assert.equal(invalidQuantityResponse.status, 400);

    const purchaseWithQuote = { ...purchase, quoteToken: quote.quoteToken };
    rateUpdatedAt = "2026-04-12 09:01:00";
    const staleQuoteResponse = await fetch(`${apiBase}/api/customer/orders/purchase`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": key },
      body: JSON.stringify(purchaseWithQuote),
    });
    assert.equal(staleQuoteResponse.status, 409);
    assert.equal(orders.length, 0);
    rateUpdatedAt = "2026-04-12 09:00:00";

    const createdResponse = await fetch(`${apiBase}/api/customer/orders/purchase`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": key },
      body: JSON.stringify(purchaseWithQuote),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal(created.order.status, "Pending");
    assert.equal(created.order.paymentStatus, "Pending");
    assert.equal(created.order.quantity, 0.08);
    assert.equal(created.order.amount, 1055.76);
    assert.deepEqual(created.order.taxBreakdown, quote.taxBreakdown);
    assert.equal(created.payment.status, "Pending");
    assert.equal(created.payment.paymentMode, "no-gateway");
    assert.equal(created.idempotent, false);
    assert.equal(orders.length, 1);
    assert.equal(payments.length, 1);

    const retryResponse = await fetch(`${apiBase}/api/customer/orders/purchase`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": key },
      body: JSON.stringify(purchaseWithQuote),
    });
    assert.equal(retryResponse.status, 200);
    const retry = await retryResponse.json();
    assert.equal(retry.order.id, created.order.id);
    assert.equal(retry.idempotent, true);
    assert.equal(orders.length, 1);
    assert.equal(payments.length, 1);

    const mismatchedRetry = await fetch(`${apiBase}/api/customer/orders/purchase`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": key },
      body: JSON.stringify({ ...purchaseWithQuote, value: "1001" }),
    });
    assert.equal(mismatchedRetry.status, 409);
    assert.equal(orders.length, 1);

    failPaymentInsert = true;
    const rollbackResponse = await fetch(`${apiBase}/api/customer/orders/purchase`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "quickbuy-rollback-key-123456" },
      body: JSON.stringify(purchaseWithQuote),
    });
    assert.equal(rollbackResponse.status, 500);
    assert.equal(orders.length, 1);
    assert.equal(payments.length, 1);
    assert.ok(rollbackCount > 0);
    assert.equal(loggedWriteError, true);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    if (originalExecute) Object.defineProperty(database, "execute", originalExecute);
    else Reflect.deleteProperty(database, "execute");
    if (originalGetConnection) Object.defineProperty(database, "getConnection", originalGetConnection);
    else Reflect.deleteProperty(database, "getConnection");
    console.error = originalConsoleError;
  }
});
