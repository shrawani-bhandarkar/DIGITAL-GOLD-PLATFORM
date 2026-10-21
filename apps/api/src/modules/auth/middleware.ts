import type { NextFunction, Request, Response } from "express";
import type { RowDataPacket } from "mysql2";
import database from "../../config/database";
import { hashAdminToken, verifyAdminToken } from "./tokens";

export const ADMIN_COOKIE = "dg_admin_session";
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export interface AdminProfile {
  id: string | number;
  email: string;
  name: string;
  roleId: string;
}

interface AdminRecord extends RowDataPacket {
  id: string | number;
  email: string;
  role: string;
}

interface SuperAdminRecord extends RowDataPacket {
  id: string | number;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  admin: AdminProfile;
}

export function readAdminCookie(request: Request): string | null {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  const token = cookie?.slice(ADMIN_COOKIE.length + 1);
  return token || null;
}

export async function findAdminForToken(token: string): Promise<AdminProfile | null> {
  const claims = verifyAdminToken(token);
  if (!claims) return null;

  if (claims.accountType === "superadmin") {
    const [superAdmins] = await database.execute<SuperAdminRecord[]>(
      `SELECT a.id, a.email
       FROM superadmin_jwt_sessions AS s
       INNER JOIN superadmins AS a ON a.id = s.superadmin_id
       WHERE s.token_hash = ?
         AND s.expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      [hashAdminToken(token)],
    );
    const superAdmin = superAdmins[0];
    if (!superAdmin) return null;
    return {
      id: superAdmin.id,
      email: superAdmin.email,
      name: displayNameForEmail(superAdmin.email),
      roleId: "SUPER_ADMIN",
    };
  }

  const [admins] = await database.execute<AdminRecord[]>(
    `SELECT a.id, a.email, a.role
     FROM admin_jwt_sessions AS s
     INNER JOIN admins AS a ON a.id = s.admin_id
     WHERE s.token_hash = ?
       AND s.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [hashAdminToken(token)],
  );
  const admin = admins[0];
  if (!admin) return null;
  return {
    id: admin.id,
    email: admin.email,
    name: displayNameForEmail(admin.email),
    roleId: admin.role.toUpperCase() === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
  };
}

export function displayNameForEmail(email: string): string {
  return email
    .split("@", 1)[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function setAdminCookie(response: Response, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${SESSION_DURATION_SECONDS}${secure}`,
  );
}

export function clearAdminCookie(response: Response): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0${secure}`,
  );
}

export async function requireAdmin(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const token = readAdminCookie(request);
  if (!token) {
    response.status(401).json({ message: "Authentication is required." });
    return;
  }

  try {
    const admin = await findAdminForToken(token);
    if (!admin) {
      clearAdminCookie(response);
      response.status(401).json({ message: "Your sign-in session is invalid or expired." });
      return;
    }
    (request as AuthenticatedRequest).admin = admin;
    next();
  } catch (error) {
    console.error("Admin authorization failed:", error);
    response.status(500).json({ message: "Could not verify the sign-in session." });
  }
}
