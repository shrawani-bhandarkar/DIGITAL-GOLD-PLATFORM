import { describe, expect, it } from 'vitest';
import {
  calculateBuyQuote,
  calculateMakingChargePaise,
  calculatePortfolio,
  calculateReconciliationDifference,
  calculateRedemptionQuote,
  calculateSellQuote,
  calculateSipSchedule,
  assertQuantityWithinConfiguredLimits,
  deriveDashboardMetrics,
  formatGrams,
  formatPaise,
  parseMoneyPaise,
  parseQuantityMilliGrams,
  productFeePolicy,
  sumPaise,
} from '../utils/financial.js';

describe('integer-based demo financial calculations', () => {
  it('quotes amount- and quantity-based buys in paise and milligrams', () => {
    expect(calculateBuyQuote({ basis: 'amount', value: '100.00', ratePerGram: '30.00' })).toEqual({
      baseAmountPaise: 10000,
      quantityMilliGrams: 3333,
      makingChargePaise: 0,
      purchaseSubtotalPaise: 10000,
      chargePaise: 0,
      taxPaise: 0,
      totalPaise: 10000,
    });
    expect(calculateBuyQuote({
      basis: 'quantity',
      value: '1.234',
      ratePerGram: '100.00',
      feePolicy: { buyChargeBps: 100, buyTaxBps: 1800 },
    })).toEqual({
      baseAmountPaise: 12340,
      quantityMilliGrams: 1234,
      makingChargePaise: 0,
      purchaseSubtotalPaise: 12340,
      chargePaise: 123,
      taxPaise: 22,
      totalPaise: 12485,
    });
  });

  it('calculates independent per-metal making charges using integer paise and milligrams', () => {
    const examples = [
      { metal: 'Gold', weight: '1', rate: 7000, chargePaise: 25000, valuePaise: 700000, makingPaise: 25000, subtotalPaise: 725000 },
      { metal: 'Silver', weight: '10', rate: 100, chargePaise: 1000, valuePaise: 100000, makingPaise: 10000, subtotalPaise: 110000 },
      { metal: 'Platinum', weight: '1', rate: 4000, chargePaise: 30000, valuePaise: 400000, makingPaise: 30000, subtotalPaise: 430000 },
    ];
    for (const example of examples) {
      expect(calculateBuyQuote({
        basis: 'quantity',
        value: example.weight,
        ratePerGram: example.rate,
        makingChargePerGramPaise: example.chargePaise,
        makingChargeEnabled: true,
      })).toMatchObject({
        baseAmountPaise: example.valuePaise,
        makingChargePaise: example.makingPaise,
        purchaseSubtotalPaise: example.subtotalPaise,
        totalPaise: example.subtotalPaise,
      });
    }
    expect(calculateBuyQuote({
      basis: 'amount',
      value: '7000',
      ratePerGram: 7000,
      makingChargePerGramPaise: 25000,
      makingChargeEnabled: true,
    })).toMatchObject({ quantityMilliGrams: 1000, makingChargePaise: 25000, purchaseSubtotalPaise: 725000 });
    expect(calculateMakingChargePaise(333, 1000)).toBe(333);
    expect(calculateMakingChargePaise(1000, 25000, false)).toBe(0);
    expect(calculateBuyQuote({
      basis: 'quantity',
      value: '1',
      ratePerGram: 7000,
      makingChargePerGramPaise: 25000,
      makingChargeEnabled: false,
    })).toMatchObject({ makingChargePaise: 0, purchaseSubtotalPaise: 700000 });
  });

  it('rejects invalid making charge inputs and permits an enabled zero charge', () => {
    expect(calculateBuyQuote({
      basis: 'quantity',
      value: '1',
      ratePerGram: 100,
      makingChargePerGramPaise: 0,
      makingChargeEnabled: true,
    })).toMatchObject({ makingChargePaise: 0, purchaseSubtotalPaise: 10000 });
    expect(() => calculateMakingChargePaise(0, 100)).toThrow(/positive/);
    expect(() => calculateMakingChargePaise(1000, -1)).toThrow(/non-negative/);
    expect(() => calculateMakingChargePaise(1000, 100.5)).toThrow(/non-negative/);
    expect(() => calculateMakingChargePaise(1000, 100, 'enabled')).toThrow(/status/);
  });

  it('calculates sell proceeds and redemption charges separately', () => {
    expect(calculateSellQuote({
      quantity: '1.234',
      ratePerGram: '100',
      feePolicy: { sellChargeBps: 100, sellTaxBps: 1800 },
    })).toEqual({ quantityMilliGrams: 1234, grossPaise: 12340, chargePaise: 123, taxPaise: 22, netPaise: 12195 });
    expect(calculateRedemptionQuote({
      quantity: '1.000',
      ratePerGram: '100',
      mode: 'Coin delivery',
      feePolicy: { deliveryChargePaise: 500, deliveryTaxBps: 1800 },
    })).toEqual({
      quantityMilliGrams: 1000,
      grossPaise: 10000,
      deliveryChargePaise: 500,
      taxPaise: 90,
      totalPaise: 10590,
    });
  });

  it('applies independent product fee and quantity policies across metals', () => {
    const goldPolicy = productFeePolicy({
      buyChargeBps: 100,
      buyTaxBps: 1800,
      sellChargeBps: 200,
      sellTaxBps: 1000,
      redemptionChargePaise: 250,
      redemptionTaxBps: 500,
    });
    const platinumPolicy = productFeePolicy({
      buyChargeBps: 0,
      buyTaxBps: 0,
      sellChargeBps: 0,
      sellTaxBps: 0,
      redemptionChargePaise: 0,
      redemptionTaxBps: 0,
    });

    expect(calculateBuyQuote({ basis: 'quantity', value: '1', ratePerGram: 100, feePolicy: goldPolicy })).toMatchObject({
      baseAmountPaise: 10000, chargePaise: 100, taxPaise: 18, totalPaise: 10118,
    });
    expect(calculateSellQuote({ quantity: '1', ratePerGram: 100, feePolicy: goldPolicy })).toMatchObject({
      grossPaise: 10000, chargePaise: 200, taxPaise: 20, netPaise: 9780,
    });
    expect(calculateRedemptionQuote({ quantity: '1', ratePerGram: 100, mode: 'Coin delivery', feePolicy: goldPolicy })).toMatchObject({
      deliveryChargePaise: 250, taxPaise: 13, totalPaise: 10263,
    });
    expect(calculateBuyQuote({ basis: 'quantity', value: '1', ratePerGram: 100, feePolicy: platinumPolicy }).totalPaise).toBe(10000);
    expect(() => assertQuantityWithinConfiguredLimits(500, { minimum: '0.600', maximum: '2.000', label: 'Buy quantity' })).toThrow(/at least 0.600 g/);
    expect(() => assertQuantityWithinConfiguredLimits(2500, { minimum: '0.600', maximum: '2.000', label: 'Buy quantity' })).toThrow(/cannot exceed 2.000 g/);
    expect(() => assertQuantityWithinConfiguredLimits(1000, { minimum: '2.000', maximum: '1.000', label: 'Redemption quantity' })).toThrow(/cannot exceed the maximum/);
  });

  it.each([
    ['0', parseMoneyPaise],
    ['-1', parseMoneyPaise],
    ['1.001', parseMoneyPaise],
    ['NaN', parseMoneyPaise],
    ['Infinity', parseMoneyPaise],
    ['0', parseQuantityMilliGrams],
    ['-0.001', parseQuantityMilliGrams],
    ['1.0001', parseQuantityMilliGrams],
    ['NaN', parseQuantityMilliGrams],
    ['Infinity', parseQuantityMilliGrams],
  ])('rejects invalid financial input %s', (value, parser) => {
    expect(() => parser(value)).toThrow(RangeError);
  });

  it('rejects invalid purchase bases and missing or non-positive rates', () => {
    expect(() => calculateBuyQuote({ basis: 'unknown', value: '10', ratePerGram: 100 })).toThrow(/purchase/);
    expect(() => calculateBuyQuote({ basis: 'amount', value: '10', ratePerGram: 0 })).toThrow(/Rate per gram/);
    expect(() => calculateSellQuote({ quantity: '1', ratePerGram: Number.NaN })).toThrow(/Rate per gram/);
  });

  it('tracks credits, debits, reservations, and releases at milligram precision', () => {
    const [holding] = calculatePortfolio([
      { customerId: 'CUS-1', productId: 'MET-1', action: 'CREDIT', quantity: '3.000' },
      { customerId: 'CUS-1', productId: 'MET-1', action: 'RESERVE', quantity: '1.000' },
      { customerId: 'CUS-1', productId: 'MET-1', action: 'RELEASE', quantity: '0.200' },
      { customerId: 'CUS-1', productId: 'MET-1', action: 'DEBIT', quantity: '0.500' },
    ]);
    expect(holding).toMatchObject({ availableMilliGrams: 1700, reservedMilliGrams: 800, totalMilliGrams: 2500 });
    expect(() => calculatePortfolio([{ customerId: 'CUS-1', productId: 'MET-1', action: 'DEBIT', quantity: '0.001' }])).toThrow(/cannot be negative/);
  });

  it('builds weekly and month-end-clipped SIP schedules without claiming payment execution', () => {
    expect(calculateSipSchedule('2026-01-31', 'Monthly', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(calculateSipSchedule('2026-01-01', 'Weekly', 3)).toEqual(['2026-01-01', '2026-01-08', '2026-01-15']);
    expect(() => calculateSipSchedule('2026-02-30', 'Monthly', 2)).toThrow(/valid first installment date/);
    expect(() => calculateSipSchedule('2026-01-01', 'Daily', 2)).toThrow(/frequency/);
    expect(() => calculateSipSchedule('2026-01-01', 'Weekly', 61)).toThrow(/2 and 60/);
  });

  it('counts only unique completed orders in the 30-day sample and excludes failures', () => {
    const metrics = deriveDashboardMetrics({
      customers: [{ id: 1, kycStatus: 'Verified' }, { id: 2, kycStatus: 'Pending' }],
      orders: [
        { id: 'A', type: 'Buy', status: 'Completed', amount: 100, placedAt: '15 Oct 2026, 10:00' },
        { id: 'A', type: 'Buy', status: 'Completed', amount: 100, placedAt: '15 Oct 2026, 10:00' },
        { id: 'B', type: 'Sell', status: 'Failed', amount: 500, placedAt: '15 Oct 2026, 11:00' },
        { id: 'C', type: 'Buy', status: 'Processing', amount: 250, placedAt: '15 Oct 2026, 12:00' },
        { id: 'D', type: 'Buy', status: 'Completed', amount: 999, placedAt: '01 Jan 2026, 10:00' },
      ],
      payments: [{ status: 'Pending' }, { status: 'Processing' }, { status: 'Successful' }],
      sips: [{ status: 'Active' }, { status: 'Paused' }],
      redemptions: [{ status: 'Pending' }, { status: 'Processing' }],
    });
    expect(metrics).toMatchObject({
      registeredCustomers: 2,
      verifiedCustomers: 1,
      completedOrderCount: 1,
      completedAmountPaise: 10000,
      pendingPayments: 2,
      failedOrders: 1,
      pendingRedemptions: 1,
      activeSips: 1,
      startDate: '2026-09-16',
      endDate: '2026-10-15',
    });
  });

  it('uses actual minus expected for reconciliation and formats currency and quantity explicitly', () => {
    expect(calculateReconciliationDifference(100, 125.25)).toBe(2525);
    expect(calculateReconciliationDifference(100, 75.25)).toBe(-2475);
    expect(formatPaise(-2475)).toBe('₹-24.75');
    expect(formatGrams(1234)).toBe('1.234 g');
    expect(sumPaise([125, -50, 25])).toBe(100);
    expect(() => sumPaise([Number.MAX_SAFE_INTEGER, 1])).toThrow(/safe integer limit/);
  });
});
