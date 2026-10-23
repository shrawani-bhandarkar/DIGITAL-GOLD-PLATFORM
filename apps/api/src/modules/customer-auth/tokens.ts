import { createHash, createHmac, randomUUID } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";

const CUSTOMER_SESSION_SECONDS = 8 * 60 * 60;

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes.");
  }
  return secret;
}

export function hashCustomerOtp(otp: string): Buffer {
  const otpKey = createHmac("sha256", jwtSecret()).update("customer-otp-hmac-key-v1").digest();
  return createHmac("sha256", otpKey).update(otp).digest();
}

export function hashCustomerToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export function createCustomerToken(userId: string | number, mobileNumber: string): string {
  return jwt.sign(
    { accountType: "customer", mobileNumber },
    jwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: CUSTOMER_SESSION_SECONDS,
      jwtid: randomUUID(),
      subject: String(userId),
    },
  );
}

export interface CustomerTokenClaims extends JwtPayload {
  sub: string;
  accountType: "customer";
  mobileNumber: string;
}

export function verifyCustomerToken(token: string): CustomerTokenClaims | null {
  try {
    const claims = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] });
    if (
      typeof claims === "string"
      || typeof claims.sub !== "string"
      || !/^\d+$/.test(claims.sub)
      || claims.accountType !== "customer"
      || typeof claims.mobileNumber !== "string"
    ) {
      return null;
    }
    return {
      ...claims,
      sub: claims.sub,
      accountType: "customer",
      mobileNumber: claims.mobileNumber,
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) return null;
    throw error;
  }
}
