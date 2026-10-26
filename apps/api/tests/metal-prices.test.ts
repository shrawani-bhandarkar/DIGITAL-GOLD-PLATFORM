import assert from "node:assert/strict";
import { test } from "node:test";
import { saveMetalPriceSchema } from "../src/modules/metal-prices/validation";

test("daily metal price accepts supported metals and a valid effective date", () => {
  const result = saveMetalPriceSchema.safeParse({
    metalType: "Gold",
    ratePerGram: 7825.5,
    purity: "24K / 999.9%",
    effectiveDate: "2026-10-24",
  });

  assert.equal(result.success, true);
});

test("daily metal price rejects unsupported metals, invalid values, and extra fields", () => {
  for (const input of [
    { metalType: "Copper", ratePerGram: 10, purity: "99%", effectiveDate: "2026-10-24" },
    { metalType: "Silver", ratePerGram: 0, purity: "99%", effectiveDate: "2026-10-24" },
    { metalType: "Silver", ratePerGram: 1.12345, purity: "99%", effectiveDate: "2026-10-24" },
    { metalType: "Platinum", ratePerGram: 10, purity: "95%", effectiveDate: "2026-02-30" },
    { metalType: "Gold", ratePerGram: 10, purity: "99%", effectiveDate: "2026-10-24", actor: "Admin" },
  ]) {
    assert.equal(saveMetalPriceSchema.safeParse(input).success, false);
  }
});
