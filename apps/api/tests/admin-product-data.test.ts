import assert from "node:assert/strict";
import { test } from "node:test";
import { mapMetalProduct } from "../src/modules/admin-console/product-data";

test("metal product records restore dashboard fields from authoritative database columns", () => {
  const product = mapMetalProduct({
    product_id: "GOLD_24K",
    name: "24K Gold",
    metal: "Gold",
    purity: "24K (999.9)",
    status: "ACTIVE",
    record_data: JSON.stringify({ buyRate: 7825, sellRate: 7580 }),
  });

  assert.deepEqual(product, {
    id: "GOLD_24K",
    name: "24K Gold",
    metal: "Gold",
    purity: "24K (999.9)",
    status: "Active",
    buyRate: 7825,
    sellRate: 7580,
  });
});

test("metal product mapping surfaces malformed stored JSON instead of masking it", () => {
  assert.throws(() => mapMetalProduct({
    product_id: "BROKEN",
    name: "Broken product",
    metal: "Gold",
    purity: "24K",
    status: "ACTIVE",
    record_data: "{",
  }));
});
