import assert from "node:assert/strict";
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
