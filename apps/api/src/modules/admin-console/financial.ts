const QUANTITY_SCALE = 1000;

function safeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} exceeds the safe integer limit.`);
  return value;
}

function parseMoneyPaise(value: unknown, label: string): number {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`${label} must be a valid amount.`);
  const paise = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(paise) || paise < 0) throw new Error(`${label} must be a non-negative amount.`);
  return paise;
}

export function parseQuantityMilliGrams(value: unknown): number {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(text)) throw new Error("Quantity must be positive with up to three decimal places.");
  const quantity = Math.round(Number(text) * QUANTITY_SCALE);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Quantity must be positive.");
  return quantity;
}

function ratePaise(value: unknown): number {
  const rate = parseMoneyPaise(value, "Rate per gram");
  if (rate <= 0) throw new Error("Rate per gram must be positive.");
  return rate;
}

function multiplyDivideRounded(left: number, right: number, divisor: number): number {
  const result = (BigInt(left) * BigInt(right) + BigInt(divisor) / 2n) / BigInt(divisor);
  const number = Number(result);
  return safeInteger(number, "Calculated amount");
}

function chargeFor(amountPaise: number, basisPoints: unknown): number {
  const bps = Number(basisPoints ?? 0);
  if (!Number.isSafeInteger(bps) || bps < 0) throw new Error("Charge must be a non-negative whole number of basis points.");
  return multiplyDivideRounded(amountPaise, bps, 10_000);
}

function validateQuantityLimits(quantityMilliGrams: number, minimum: unknown, maximum: unknown): void {
  const min = minimum === undefined || minimum === null || minimum === "" ? null : parseQuantityMilliGrams(minimum);
  const max = maximum === undefined || maximum === null || maximum === "" ? null : parseQuantityMilliGrams(maximum);
  if ((min !== null && quantityMilliGrams < min) || (max !== null && quantityMilliGrams > max)) {
    throw new Error("Quantity is outside this product's configured limits.");
  }
}

export function calculateOrderAmounts(
  order: Record<string, unknown>,
  product: Record<string, unknown>,
  makingChargePerGramPaise = 0,
  makingChargeEnabled = false,
): Record<string, unknown> {
  const type = order.type;
  const quantityMilliGrams = parseQuantityMilliGrams(order.quantity);
  const quantity = quantityMilliGrams / QUANTITY_SCALE;
  const rate = ratePaise(type === "Buy" ? product.buyRate : product.sellRate);
  const baseAmountPaise = multiplyDivideRounded(quantityMilliGrams, rate, QUANTITY_SCALE);
  const amountInRupees = (paise: number) => paise / 100;

  if (type === "Buy") {
    validateQuantityLimits(quantityMilliGrams, product.minBuyQuantity, product.maxBuyQuantity);
    const minOrder = parseMoneyPaise(product.minOrder, "Minimum order");
    const maxOrder = parseMoneyPaise(product.maxOrder, "Maximum order");
    if (baseAmountPaise < minOrder || baseAmountPaise > maxOrder) throw new Error("Purchase amount is outside this product's configured limits.");
    const making = makingChargeEnabled ? multiplyDivideRounded(quantityMilliGrams, makingChargePerGramPaise, QUANTITY_SCALE) : 0;
    const purchaseSubtotal = baseAmountPaise + making;
    safeInteger(purchaseSubtotal, "Purchase subtotal");
    const charges = chargeFor(baseAmountPaise, product.buyChargeBps);
    const taxes = chargeFor(charges, product.buyTaxBps);
    const total = purchaseSubtotal + charges + taxes;
    safeInteger(total, "Purchase total");
    return {
      ...order,
      rate: Number(product.buyRate),
      quantity,
      baseAmount: amountInRupees(baseAmountPaise),
      charges: amountInRupees(charges),
      taxes: amountInRupees(taxes),
      amount: amountInRupees(total),
      makingCharges: amountInRupees(making),
      makingChargePerGram: makingChargePerGramPaise / 100,
      makingChargeEnabled,
      purchaseSubtotal: amountInRupees(purchaseSubtotal),
    };
  }

  if (type !== "Sell") throw new Error("Choose Buy or Sell.");
  validateQuantityLimits(quantityMilliGrams, product.minSellQuantity, product.maxSellQuantity);
  const charges = chargeFor(baseAmountPaise, product.sellChargeBps);
  const taxes = chargeFor(charges, product.sellTaxBps);
  const net = baseAmountPaise - charges - taxes;
  if (net < 0) throw new Error("Selling charges and taxes exceed gross proceeds.");
  return {
    ...order,
    rate: Number(product.sellRate),
    quantity,
    baseAmount: amountInRupees(baseAmountPaise),
    charges: amountInRupees(charges),
    taxes: amountInRupees(taxes),
    amount: amountInRupees(net),
    makingCharges: 0,
    makingChargePerGram: 0,
    makingChargeEnabled: false,
  };
}

export function calculateRedemptionAmounts(
  redemption: Record<string, unknown>,
  product: Record<string, unknown>,
): Record<string, unknown> {
  const mode = redemption.mode;
  if (mode !== "Coin delivery" && mode !== "Cash payout") throw new Error("Choose a supported fulfillment method.");
  if (product.redemptionEnabled !== true) throw new Error("Redemption is not enabled for this product.");
  if (mode === "Coin delivery" && product.allowCoinDelivery !== true) throw new Error("Coin delivery is not enabled for this product.");
  if (mode === "Cash payout" && product.allowCashPayout !== true) throw new Error("Cash payout is not enabled for this product.");
  const quantityMilliGrams = parseQuantityMilliGrams(redemption.quantity);
  validateQuantityLimits(quantityMilliGrams, product.minRedemptionQuantity, product.maxRedemptionQuantity);
  const quantity = quantityMilliGrams / QUANTITY_SCALE;
  const rate = ratePaise(mode === "Cash payout" ? product.sellRate : product.buyRate);
  const gross = multiplyDivideRounded(quantityMilliGrams, rate, QUANTITY_SCALE);
  const deliveryCharge = mode === "Coin delivery" ? parseMoneyPaise(Number(product.redemptionChargePaise ?? 0) / 100, "Delivery charge") : 0;
  const taxes = chargeFor(deliveryCharge, product.redemptionTaxBps);
  const total = mode === "Cash payout" ? gross - deliveryCharge - taxes : gross + deliveryCharge + taxes;
  if (total < 0) throw new Error("Redemption charges and taxes exceed the gross amount.");
  return {
    ...redemption,
    rate: rate / 100,
    quantity,
    grossAmount: gross / 100,
    deliveryCharge: deliveryCharge / 100,
    taxes: taxes / 100,
    amount: total / 100,
  };
}
