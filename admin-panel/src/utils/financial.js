export const QUANTITY_SCALE = 1000;
export const DEMO_FEE_POLICY = Object.freeze({
  buyChargeBps: 0,
  buyTaxBps: 0,
  sellChargeBps: 0,
  sellTaxBps: 0,
  deliveryChargePaise: 0,
  deliveryTaxBps: 0,
});

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function assertSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} exceeds the safe integer limit.`);
  return value;
}

function addSafe(left, right, label) {
  return assertSafeInteger(left + right, label);
}

function parseDecimal(value, label, decimals, allowZero = false) {
  const text = String(value ?? '').trim();
  const pattern = decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`);
  if (!pattern.test(text)) throw new RangeError(`${label} must be a valid number with up to ${decimals} decimal places.`);
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || (!allowZero && parsed <= 0) || (allowZero && parsed < 0)) {
    throw new RangeError(`${label} must be ${allowZero ? 'zero or positive' : 'positive'}.`);
  }
  return parsed;
}

export function parseMoneyPaise(value, label = 'Amount', allowZero = false) {
  const amount = parseDecimal(value, label, 2, allowZero);
  const paise = Math.round(amount * 100);
  if (!Number.isSafeInteger(paise) || paise > MAX_SAFE) throw new RangeError(`${label} is too large.`);
  return paise;
}

export function parseQuantityMilliGrams(value, label = 'Quantity') {
  const grams = parseDecimal(value, label, 3);
  const milligrams = Math.round(grams * QUANTITY_SCALE);
  if (!Number.isSafeInteger(milligrams) || milligrams > MAX_SAFE) throw new RangeError(`${label} is too large.`);
  return milligrams;
}

export function assertQuantityWithinConfiguredLimits(quantityMilliGrams, { minimum, maximum, label = 'Quantity' } = {}) {
  assertSafeInteger(quantityMilliGrams, label);
  const minimumMilliGrams = minimum === undefined || minimum === null || minimum === ''
    ? null
    : parseQuantityMilliGrams(minimum, `Minimum ${label.toLowerCase()}`);
  const maximumMilliGrams = maximum === undefined || maximum === null || maximum === ''
    ? null
    : parseQuantityMilliGrams(maximum, `Maximum ${label.toLowerCase()}`);
  if (minimumMilliGrams !== null && maximumMilliGrams !== null && minimumMilliGrams > maximumMilliGrams) {
    throw new RangeError(`Minimum ${label.toLowerCase()} cannot exceed the maximum.`);
  }
  if (minimumMilliGrams !== null && quantityMilliGrams < minimumMilliGrams) {
    throw new RangeError(`${label} must be at least ${formatGrams(minimumMilliGrams)}.`);
  }
  if (maximumMilliGrams !== null && quantityMilliGrams > maximumMilliGrams) {
    throw new RangeError(`${label} cannot exceed ${formatGrams(maximumMilliGrams)}.`);
  }
}

export function productFeePolicy(product) {
  return {
    buyChargeBps: product.buyChargeBps ?? DEMO_FEE_POLICY.buyChargeBps,
    buyTaxBps: product.buyTaxBps ?? DEMO_FEE_POLICY.buyTaxBps,
    sellChargeBps: product.sellChargeBps ?? DEMO_FEE_POLICY.sellChargeBps,
    sellTaxBps: product.sellTaxBps ?? DEMO_FEE_POLICY.sellTaxBps,
    deliveryChargePaise: product.redemptionChargePaise ?? DEMO_FEE_POLICY.deliveryChargePaise,
    deliveryTaxBps: product.redemptionTaxBps ?? DEMO_FEE_POLICY.deliveryTaxBps,
  };
}

export function sumPaise(values, label = 'Financial total') {
  return values.reduce((total, value) => addSafe(total, assertSafeInteger(value, label), label), 0);
}

export function sumMoneyPaise(values, label = 'Financial total') {
  return sumPaise(values.map((value) => parseMoneyPaise(value, 'Amount', true)), label);
}

function parseRatePaise(value) {
  const rate = parseDecimal(value, 'Rate per gram', 2);
  const paise = Math.round(rate * 100);
  if (!Number.isSafeInteger(paise)) throw new RangeError('Rate per gram is too large.');
  return paise;
}

function multiplyDivideRounded(left, right, divisor) {
  const product = left * right;
  if (!Number.isSafeInteger(product)) throw new RangeError('Calculated amount is too large.');
  return Math.round(product / divisor);
}

function chargeFor(basePaise, basisPoints) {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) throw new RangeError('Fee policy must use non-negative integer basis points.');
  return multiplyDivideRounded(basePaise, basisPoints, 10000);
}

export function calculateBuyQuote({ basis, value, ratePerGram, feePolicy = DEMO_FEE_POLICY }) {
  const ratePaise = parseRatePaise(ratePerGram);
  let baseAmountPaise;
  let quantityMilliGrams;

  if (basis === 'amount') {
    baseAmountPaise = parseMoneyPaise(value);
    quantityMilliGrams = multiplyDivideRounded(baseAmountPaise, QUANTITY_SCALE, ratePaise);
  } else if (basis === 'quantity') {
    quantityMilliGrams = parseQuantityMilliGrams(value);
    baseAmountPaise = multiplyDivideRounded(quantityMilliGrams, ratePaise, QUANTITY_SCALE);
  } else {
    throw new RangeError('Choose an amount-based or quantity-based purchase.');
  }

  const chargePaise = chargeFor(baseAmountPaise, feePolicy.buyChargeBps);
  const taxPaise = chargeFor(chargePaise, feePolicy.buyTaxBps);
  const totalPaise = addSafe(addSafe(baseAmountPaise, chargePaise, 'Purchase amount'), taxPaise, 'Purchase amount');
  return { baseAmountPaise, quantityMilliGrams, chargePaise, taxPaise, totalPaise };
}

export function calculateSellQuote({ quantity, ratePerGram, feePolicy = DEMO_FEE_POLICY }) {
  const quantityMilliGrams = parseQuantityMilliGrams(quantity);
  const ratePaise = parseRatePaise(ratePerGram);
  const grossPaise = multiplyDivideRounded(quantityMilliGrams, ratePaise, QUANTITY_SCALE);
  const chargePaise = chargeFor(grossPaise, feePolicy.sellChargeBps);
  const taxPaise = chargeFor(chargePaise, feePolicy.sellTaxBps);
  const netPaise = assertSafeInteger(grossPaise - chargePaise - taxPaise, 'Net proceeds');
  if (netPaise < 0) throw new RangeError('Selling charges and taxes cannot exceed gross proceeds.');
  return { quantityMilliGrams, grossPaise, chargePaise, taxPaise, netPaise };
}

export function calculateRedemptionQuote({ quantity, ratePerGram, mode, feePolicy = DEMO_FEE_POLICY }) {
  if (!['Coin delivery', 'Cash payout'].includes(mode)) throw new RangeError('Choose a supported redemption method.');
  const quantityMilliGrams = parseQuantityMilliGrams(quantity);
  const ratePaise = parseRatePaise(ratePerGram);
  const grossPaise = multiplyDivideRounded(quantityMilliGrams, ratePaise, QUANTITY_SCALE);
  const deliveryChargePaise = mode === 'Coin delivery' ? feePolicy.deliveryChargePaise : 0;
  if (!Number.isSafeInteger(deliveryChargePaise) || deliveryChargePaise < 0) throw new RangeError('Delivery charge must be a non-negative whole number of paise.');
  const taxPaise = chargeFor(deliveryChargePaise, feePolicy.deliveryTaxBps);
  const totalPaise = mode === 'Cash payout'
    ? assertSafeInteger(grossPaise - deliveryChargePaise - taxPaise, 'Net payout')
    : addSafe(addSafe(grossPaise, deliveryChargePaise, 'Redemption total'), taxPaise, 'Redemption total');
  if (totalPaise < 0) throw new RangeError('Redemption charges and taxes cannot exceed the gross amount.');
  return {
    quantityMilliGrams,
    grossPaise,
    deliveryChargePaise,
    taxPaise,
    totalPaise,
  };
}

export function calculatePortfolio(ledgerEntries) {
  const holdings = new Map();
  const orderedEntries = [...ledgerEntries].sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));

  for (const entry of orderedEntries) {
    const quantity = parseQuantityMilliGrams(entry.quantity, 'Ledger quantity');
    const key = `${entry.customerId}:${entry.productId}`;
    const holding = holdings.get(key) ?? { customerId: entry.customerId, productId: entry.productId, availableMilliGrams: 0, reservedMilliGrams: 0 };

    if (entry.action === 'CREDIT') holding.availableMilliGrams = addSafe(holding.availableMilliGrams, quantity, 'Ledger quantity');
    else if (entry.action === 'DEBIT') holding.availableMilliGrams = assertSafeInteger(holding.availableMilliGrams - quantity, 'Ledger quantity');
    else if (entry.action === 'RESERVE') {
      holding.availableMilliGrams = assertSafeInteger(holding.availableMilliGrams - quantity, 'Ledger quantity');
      holding.reservedMilliGrams = addSafe(holding.reservedMilliGrams, quantity, 'Reserved ledger quantity');
    } else if (entry.action === 'RELEASE') {
      holding.availableMilliGrams = addSafe(holding.availableMilliGrams, quantity, 'Ledger quantity');
      holding.reservedMilliGrams = assertSafeInteger(holding.reservedMilliGrams - quantity, 'Reserved ledger quantity');
    } else if (entry.action === 'CONSUME_RESERVATION') {
      holding.reservedMilliGrams = assertSafeInteger(holding.reservedMilliGrams - quantity, 'Reserved ledger quantity');
    } else {
      throw new RangeError(`Unsupported ledger action: ${entry.action}`);
    }

    if (holding.availableMilliGrams < 0 || holding.reservedMilliGrams < 0) {
      throw new RangeError(`Ledger balance cannot be negative for ${key}.`);
    }
    holdings.set(key, holding);
  }
  return [...holdings.values()].map((holding) => ({
    ...holding,
    totalMilliGrams: addSafe(holding.availableMilliGrams, holding.reservedMilliGrams, 'Total ledger quantity'),
  }));
}

function findProductId(record, products) {
  if (record.productId) return record.productId;
  return products.find((product) => product.metal === record.metal && record.purity?.includes(product.purity))?.id
    ?? products.find((product) => product.metal === record.metal)?.id;
}

export function orderLedgerEntries(orders, products = []) {
  return orders.flatMap((order, index) => {
    const productId = findProductId(order, products);
    if (!productId) return [];
    if (order.type === 'Buy' && order.status === 'Completed') {
      return [{ sequence: index + 1, customerId: order.customerId, productId, quantity: order.quantity, action: 'CREDIT' }];
    }
    if (order.type !== 'Sell') return [];
    if (order.status === 'Processing' || order.status === 'Pending') {
      return [{ sequence: index + 1, customerId: order.customerId, productId, quantity: order.quantity, action: 'RESERVE' }];
    }
    if (order.status === 'Completed') {
      return [{ sequence: index + 1, customerId: order.customerId, productId, quantity: order.quantity, action: 'DEBIT' }];
    }
    return [];
  });
}

export function redemptionLedgerEntries(redemptions, products = []) {
  return redemptions.flatMap((redemption, index) => {
    const productId = findProductId(redemption, products);
    if (!productId) return [];
    const entry = { sequence: index + 1, customerId: redemption.customerId, productId, quantity: redemption.quantity };
    if (redemption.status === 'Pending' || redemption.status === 'Processing' || redemption.status === 'Shipped') return [{ ...entry, action: 'RESERVE' }];
    if (redemption.status === 'Delivered' || redemption.status === 'Completed') return [{ ...entry, action: 'DEBIT' }];
    return [];
  });
}

export function calculateSipSchedule(firstDate, frequency, installmentCount) {
  if (!['Weekly', 'Monthly'].includes(frequency)) throw new RangeError('Choose a supported SIP frequency.');
  if (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 60) {
    throw new RangeError('Choose between 2 and 60 installments.');
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(firstDate ?? '');
  if (!match) throw new RangeError('Enter a valid first installment date.');
  const [, year, month, day] = match.map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) {
    throw new RangeError('Enter a valid first installment date.');
  }
  const originalDay = start.getUTCDate();
  return Array.from({ length: installmentCount }, (_, index) => {
    if (frequency === 'Weekly') {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index * 7);
      return date.toISOString().slice(0, 10);
    }
    const targetMonth = start.getUTCMonth() + index;
    const targetYear = start.getUTCFullYear() + Math.floor(targetMonth / 12);
    const monthIndex = targetMonth % 12;
    const lastDay = new Date(Date.UTC(targetYear, monthIndex + 1, 0)).getUTCDate();
    return new Date(Date.UTC(targetYear, monthIndex, Math.min(originalDay, lastDay))).toISOString().slice(0, 10);
  });
}

export function calculateReconciliationDifference(expected, actual) {
  return assertSafeInteger(parseMoneyPaise(actual, 'Actual amount', true) - parseMoneyPaise(expected, 'Expected amount', true), 'Reconciliation difference');
}

export function mockOrderDateKey(value) {
  const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})/.exec(value ?? '');
  if (!match) return '';
  const [, day, monthName, year] = match;
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(monthName);
  return month < 0 ? '' : `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function deriveDashboardMetrics({ customers, orders, payments, sips, redemptions }, asOfDate = '2026-10-15') {
  const startDate = new Date(`${asOfDate}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 29);
  const firstDate = startDate.toISOString().slice(0, 10);
  const periodOrders = orders.filter((order) => {
    const date = mockOrderDateKey(order.placedAt);
    return date >= firstDate && date <= asOfDate;
  });
  const completedById = new Map();
  for (const order of periodOrders) {
    if (order.status === 'Completed' && !completedById.has(order.id)) completedById.set(order.id, order);
  }
  const completedOrders = [...completedById.values()];
  const completedAmountPaise = sumMoneyPaise(completedOrders.map((order) => order.amount), 'Completed transaction total');
  const completedBuyAmountPaise = sumMoneyPaise(completedOrders.filter((order) => order.type === 'Buy').map((order) => order.amount), 'Completed buy total');
  const completedSellAmountPaise = sumMoneyPaise(completedOrders.filter((order) => order.type === 'Sell').map((order) => order.amount), 'Completed sell total');

  return {
    registeredCustomers: customers.length,
    verifiedCustomers: customers.filter((customer) => customer.kycStatus === 'Verified').length,
    completedOrderCount: completedOrders.length,
    completedAmountPaise,
    completedBuyAmountPaise,
    completedSellAmountPaise,
    periodOrderCount: periodOrders.length,
    pendingPayments: payments.filter((payment) => payment.status === 'Pending' || payment.status === 'Processing').length,
    failedOrders: periodOrders.filter((order) => order.status === 'Failed').length,
    pendingRedemptions: redemptions.filter((redemption) => redemption.status === 'Pending').length,
    activeSips: sips.filter((sip) => sip.status === 'Active').length,
    startDate: firstDate,
    endDate: asOfDate,
  };
}

export function formatPaise(paise) {
  if (!Number.isSafeInteger(paise)) throw new RangeError('Currency amount must be an integer number of paise.');
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatGrams(milliGrams) {
  if (!Number.isSafeInteger(milliGrams) || milliGrams < 0) throw new RangeError('Quantity must be a non-negative whole number of milligrams.');
  return `${(milliGrams / QUANTITY_SCALE).toFixed(3)} g`;
}
