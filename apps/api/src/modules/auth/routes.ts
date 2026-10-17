import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import database from "../../config/database";
import { verifyPassword } from "./credentials";
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
  password: z.string().min(1).max(1024),
}).strict();

interface AdminRecord extends RowDataPacket {
  id: string | number;
  email: string;
  role: string;
  passwordHash: string;
}

router.post("/login", async (request, response) => {
  const credentials = loginSchema.safeParse(request.body);
  if (!credentials.success) {
    response.status(400).json({ message: "Enter a valid email address and password." });
    return;
  }

  try {
    const email = credentials.data.email.toLowerCase();
    const [records] = await database.execute<AdminRecord[]>(
      `SELECT id, email, role, password AS passwordHash
       FROM admins
       WHERE email = ?
       LIMIT 1`,
      [email],
    );
    const admin = records[0];
    if (!admin || !(await verifyPassword(credentials.data.password, admin.passwordHash))) {
      response.status(401).json({ message: "Email or password is incorrect." });
      return;
    }

    const token = createAdminToken(admin);
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
  try {
    if (token && verifyAdminToken(token)) {
      await database.execute("DELETE FROM admin_jwt_sessions WHERE token_hash = ?", [
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
