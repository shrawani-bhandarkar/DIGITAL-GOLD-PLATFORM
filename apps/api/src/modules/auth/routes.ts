import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import database from "../../config/database";
import { isValidPassword, PASSWORD_REQUIREMENTS_MESSAGE } from "./password-validation";
import {
  clearAdminCookie,
  displayNameForEmail,
  findAdminForToken,
  readAdminCookie,
  setAdminCookie,
} from "./middleware";
import { createAdminToken, hashAdminToken, verifyAdminToken } from "./tokens";

const router = Router();
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().max(1024).refine(isValidPassword, PASSWORD_REQUIREMENTS_MESSAGE),
}).strict();

interface AdminRecord extends RowDataPacket {
  id: string | number;
  email: string;
  role: string;
  password: string;
}

interface SuperAdminRecord extends RowDataPacket {
  id: string | number;
  email: string; 
  password: string;
}

router.post("/login", async (request, response) => {
  const credentials = loginSchema.safeParse(request.body);
  if (!credentials.success) {
    const passwordIssue = credentials.error.issues.some((issue) => issue.path[0] === "password");
    response.status(400).json({
      message: passwordIssue
        ? PASSWORD_REQUIREMENTS_MESSAGE
        : "Enter a valid email address.",
    });
    return;
  }

  try {
    const email = credentials.data.email.toLowerCase();
    const [records] = await database.execute<AdminRecord[]>(
      `SELECT id, email, role, password
       FROM admins
       WHERE email = ?
       LIMIT 1`,
      [email],
    );
    const admin = records[0];
    const adminPasswordValid = admin?.password === credentials.data.password;

    if (admin && adminPasswordValid) {
      const token = createAdminToken({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        accountType: "admin",
      });
      await database.execute(
        `INSERT INTO admin_jwt_sessions (token_hash, admin_id, expires_at)
         VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))`,
        [hashAdminToken(token), admin.id],
      );
      setAdminCookie(response, token);
      response.json({
        user: {
          id: admin.id,
          email: admin.email,
          name: displayNameForEmail(admin.email),
          roleId: admin.role.toUpperCase() === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
        },
      });
      return;
    }

    const [superAdmins] = await database.execute<SuperAdminRecord[]>(
      `SELECT id, email, password
       FROM superadmins
       WHERE email = ?
       LIMIT 1`,
      [email],
    );
    const superAdmin = superAdmins[0];
    if (!superAdmin || superAdmin.password !== credentials.data.password) {
      response.status(401).json({ message: "Invalid email/username or password." });
      return;
    }

    const token = createAdminToken({
      id: superAdmin.id,
      email: superAdmin.email,
      role: "SUPER_ADMIN",
      accountType: "superadmin",
    });
    await database.execute(
      `INSERT INTO superadmin_jwt_sessions (token_hash, superadmin_id, expires_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))`,
      [hashAdminToken(token), superAdmin.id],
    );
    setAdminCookie(response, token);
    response.json({
      user: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: displayNameForEmail(superAdmin.email),
        roleId: "SUPER_ADMIN",
      },
    });
  } catch (error) {
    console.error("Admin sign-in failed:", error);
    response.status(500).json({ message: "Sign in is temporarily unavailable. Please try again." });
  }
});

router.get("/session", async (request, response) => {
  const token = readAdminCookie(request);
  if (!token || !verifyAdminToken(token)) {
    if (token) clearAdminCookie(response);
    response.json({ user: null });
    return;
  }

  try {
    const user = await findAdminForToken(token);
    if (!user) {
      clearAdminCookie(response);
      response.json({ user: null });
      return;
    }
    response.json({ user });
  } catch (error) {
    console.error("Admin session lookup failed:", error);
    response.status(500).json({ message: "Could not verify the sign-in session." });
  }
});

router.post("/logout", async (request, response) => {
  const token = readAdminCookie(request);
  const claims = token ? verifyAdminToken(token) : null;
  try {
    if (token && claims) {
      const sessionsTable =
        claims.accountType === "superadmin" ? "superadmin_jwt_sessions" : "admin_jwt_sessions";
      await database.execute(`DELETE FROM ${sessionsTable} WHERE token_hash = ?`, [
        hashAdminToken(token),
      ]);
    }
    clearAdminCookie(response);
    response.status(204).end();
  } catch (error) {
    console.error("Admin sign-out failed:", error);
    response.status(500).json({ message: "Could not complete sign out." });
  }
});

export default router;
