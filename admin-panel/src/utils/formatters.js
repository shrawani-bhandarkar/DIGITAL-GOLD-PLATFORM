export function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new RangeError('Currency amount must be finite.');
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
