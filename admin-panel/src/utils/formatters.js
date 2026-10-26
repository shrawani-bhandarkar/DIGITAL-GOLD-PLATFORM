export function isValidCurrencyAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string' || !value.trim()) return false;
  return Number.isFinite(Number(value));
}

export function formatCurrency(value) {
  if (!isValidCurrencyAmount(value)) {
    console.error('Invalid currency amount: expected a finite number or numeric string.');
    return 'Invalid amount';
  }
  const amount = Number(value);
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
