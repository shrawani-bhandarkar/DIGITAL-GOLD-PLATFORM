import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatCurrency, isValidCurrencyAmount } from '../utils/formatters.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('currency formatting', () => {
  it('accepts finite numeric values and numeric strings', () => {
    expect(isValidCurrencyAmount(1250.5)).toBe(true);
    expect(isValidCurrencyAmount('1250.5')).toBe(true);
    expect(formatCurrency(1250.5)).toBe('₹1,250.5');
  });

  it.each([undefined, null, '', '  ', 'NaN', 'Infinity', Number.NaN, Number.POSITIVE_INFINITY])(
    'reports invalid currency input %s without throwing',
    (value) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(isValidCurrencyAmount(value)).toBe(false);
      expect(formatCurrency(value)).toBe('Invalid amount');
      expect(error).toHaveBeenCalledWith('Invalid currency amount: expected a finite number or numeric string.');
    },
  );
});
