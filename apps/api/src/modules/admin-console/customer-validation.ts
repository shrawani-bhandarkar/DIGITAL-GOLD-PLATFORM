export interface NewCustomer {
  name: string;
  email: string;
  phone: string;
  city: string;
  pan: string;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

export function validateNewCustomer(data: Record<string, unknown>): NewCustomer {
  const name = requiredString(data.name, "Full name");
  const email = requiredString(data.email, "Email").toLowerCase();
  const phone = requiredString(data.phone, "Phone");
  const city = requiredString(data.city, "City");
  const pan = requiredString(data.pan, "PAN").toUpperCase();

  if (name.length < 2) throw new Error("Full name must contain at least 2 characters.");
  if (name.length > 80) throw new Error("Full name must be 80 characters or fewer.");
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (!/^\d{10}$/.test(phone)) {
    throw new Error("Enter a phone number containing exactly 10 digits.");
  }
  if (city.length > 60) throw new Error("City must be 60 characters or fewer.");
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
    throw new Error("Enter a valid PAN, for example ABCDE1234F.");
  }
  return { name, email, phone, city, pan };
}
