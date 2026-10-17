import { createHash, randomBytes } from "node:crypto";
import { Router, type Request, type Response } from "express";
import type { RowDataPacket } from "mysql2";
import database from "../../config/database";
import { verifyPassword } from "./credentials";

const router = Router();
const SESSION_COOKIE = "dg_admin_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

interface AdminRecord extends RowDataPacket {
  id: number;
  email: string;
  displayName: string;
  role: string;
  passwordHash: string;
  isActive: number;
}

interface SessionUser extends RowDataPacket {
  email: string;
  displayName: string;
  role: string;
}

function readSessionToken(request: Request): string | null {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function sessionTokenHash(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

function setSessionCookie(response: Response, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=${SESSION_DURATION_SECONDS}${secure}`,
  );
}

function clearSessionCookie(response: Response): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=0${secure}`,
  );
}

router.post("/login", async (request, response) => {
  const { email, password } = request.body ?? {};
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    !password ||
    password.length > 1024
  ) {
    response.status(400).json({ message: "Enter a valid email address and password." });
    return;
  }

  try {
    const [records] = await database.execute<AdminRecord[]>(
      `SELECT id, email, display_name AS displayName, role,
              password_hash AS passwordHash, is_active AS isActive
       FROM admin_users
       WHERE email = ?
       LIMIT 1`,
      [email.trim().toLowerCase()],
    );
    const admin = records[0];
    if (!admin || admin.isActive !== 1 || !(await verifyPassword(password, admin.passwordHash))) {
      response.status(401).json({ message: "Email or password is incorrect." });
      return;
    }

    const token = randomBytes(32).toString("hex");
    await database.execute(
      `INSERT INTO admin_sessions (token_hash, admin_user_id, expires_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))`,
      [sessionTokenHash(token), admin.id],
    );
    setSessionCookie(response, token);
    response.json({
      user: {
        email: admin.email,
        displayName: admin.displayName,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin sign-in failed:", error);
    response.status(500).json({ message: "Sign in is temporarily unavailable. Please try again." });
  }
});

router.get("/session", async (request, response) => {
  const token = readSessionToken(request);
  if (!token) {
    response.json({ user: null });
    return;
  }

  try {
    const [users] = await database.execute<SessionUser[]>(
      `SELECT u.email, u.display_name AS displayName, u.role
       FROM admin_sessions AS s
       INNER JOIN admin_users AS u ON u.id = s.admin_user_id
       WHERE s.token_hash = ?
         AND s.expires_at > UTC_TIMESTAMP()
         AND u.is_active = 1
       LIMIT 1`,
      [sessionTokenHash(token)],
    );
    if (!users[0]) {
      clearSessionCookie(response);
      response.json({ user: null });
      return;
    }
    response.json({ user: users[0] });
  } catch (error) {
    console.error("Admin session lookup failed:", error);
    response.status(500).json({ message: "Could not verify the sign-in session." });
  }
});

router.post("/logout", async (request, response) => {
  const token = readSessionToken(request);
  try {
    if (token) {
      await database.execute("DELETE FROM admin_sessions WHERE token_hash = ?", [
        sessionTokenHash(token),
      ]);
    }
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) {
    console.error("Admin sign-out failed:", error);
    response.status(500).json({ message: "Could not complete sign out." });
  }
});

export default router;
