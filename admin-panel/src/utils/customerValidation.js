export function validateCustomerInput(customer, customers = []) {
  const fields = [
    ['name', 'Full name'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['city', 'City'],
    ['pan', 'PAN'],
  ];
  for (const [key, label] of fields) {
    if (typeof customer[key] !== 'string' || !customer[key].trim()) {
      return `${label} is required.`;
    }
  }

  if (customer.name.length < 2) return 'Full name must contain at least 2 characters.';
  if (customer.name.length > 80) return 'Full name must be 80 characters or fewer.';
  if (customer.email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    return 'Enter a valid email address.';
  }
  if (!/^\d{10}$/.test(customer.phone)) return 'Enter a phone number containing exactly 10 digits.';
  if (customer.city.length > 60) return 'City must be 60 characters or fewer.';
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(customer.pan)) return 'Enter a valid PAN, for example ABCDE1234F.';

  if (customers.some((item) => item.email?.trim().toLowerCase() === customer.email)) {
    return 'A customer with this email address already exists.';
  }
  if (customers.some((item) => item.phone?.replace(/\D/g, '').slice(-10) === customer.phone)) {
    return 'A customer with this phone number already exists.';
  }
  if (customers.some((item) => item.pan?.trim().toUpperCase() === customer.pan)) {
    return 'A customer with this PAN already exists.';
  }
  return '';
}
