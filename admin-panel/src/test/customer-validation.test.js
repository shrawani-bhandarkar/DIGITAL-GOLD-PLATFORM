import { describe, expect, it } from 'vitest';
import { validateCustomerInput } from '../utils/customerValidation.js';

const validCustomer = {
  name: 'Priya Kapoor',
  email: 'priya@example.com',
  phone: '9876543210',
  city: 'Pune',
  pan: 'ABCDE1234F',
};

describe('customer input validation', () => {
  it.each(['name', 'email', 'phone', 'city', 'pan'])('requires %s', (field) => {
    expect(validateCustomerInput({ ...validCustomer, [field]: '  ' })).toMatch(/is required/);
  });

  it('requires a valid email, exactly 10 phone digits, and a valid PAN', () => {
    expect(validateCustomerInput({ ...validCustomer, email: 'invalid-email' })).toBe('Enter a valid email address.');
    expect(validateCustomerInput({ ...validCustomer, phone: '+919876543210' })).toBe('Enter a phone number containing exactly 10 digits.');
    expect(validateCustomerInput({ ...validCustomer, pan: 'ABCDE1234' })).toMatch(/valid PAN/);
  });

  it.each([
    [{ email: 'PRIYA@example.com' }, 'email address'],
    [{ phone: '+91 98765 43210' }, 'phone number'],
    [{ pan: 'abcde1234f' }, 'PAN'],
  ])('rejects duplicate customer identifiers', (duplicate, fieldLabel) => {
    const existingCustomer = { email: '', phone: '', pan: '', ...duplicate };
    expect(validateCustomerInput(validCustomer, [existingCustomer])).toContain(`this ${fieldLabel} already exists.`);
  });

  it('accepts a valid unique customer', () => {
    expect(validateCustomerInput(validCustomer)).toBe('');
  });
});
