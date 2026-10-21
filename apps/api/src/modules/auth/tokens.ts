import { createHash, randomUUID } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";

const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;
const configuredSecret = process.env.JWT_SECRET;

if (!configuredSecret || Buffer.byteLength(configuredSecret) < 32) {
  throw new Error("JWT_SECRET must contain at least 32 bytes.");
}
const JWT_SECRET: string = configuredSecret;

export interface AdminTokenClaims extends JwtPayload {
  sub: string;
  email: string;
  role: string;
  accountType?: "admin" | "superadmin";
}

export interface AdminTokenUser {
  id: string | number;
  email: string;
  role: string;
  accountType?: "admin" | "superadmin";
}

export function createAdminToken(admin: AdminTokenUser): string {
  return jwt.sign(
    {
      email: admin.email,
      role: admin.role,
      accountType: admin.accountType ?? "admin",
    },
    JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: TOKEN_LIFETIME_SECONDS,
      jwtid: randomUUID(),
      subject: String(admin.id),
    },
  );
}

export function verifyAdminToken(token: string): AdminTokenClaims | null {
  try {
    const claims = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof claims === "string") return null;

    const accountType = claims.accountType;
    if (
      typeof claims.sub !== "string" ||
      typeof claims.email !== "string" ||
      typeof claims.role !== "string" ||
      (accountType !== undefined &&
        accountType !== "admin" &&
        accountType !== "superadmin")
    ) {
      return null;
    }
    return {
      ...claims,
      sub: claims.sub,
      email: claims.email,
      role: claims.role,
      accountType,
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) return null;
    throw error;
  }
}

export function hashAdminToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}