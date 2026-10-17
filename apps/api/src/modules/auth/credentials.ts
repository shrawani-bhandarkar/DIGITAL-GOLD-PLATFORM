import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!/^\$2[aby]\$12\$/.test(passwordHash)) return Promise.resolve(false);
  return bcrypt.compare(password, passwordHash);
}
