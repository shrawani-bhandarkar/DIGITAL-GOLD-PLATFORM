import "dotenv/config";
import database from "../src/config/database";
import { hashPassword } from "../src/modules/auth/credentials";

async function createAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set ADMIN_EMAIL to a valid email address.");
  }
  if (!password || password.length < 12) {
    throw new Error("Set ADMIN_PASSWORD to a unique password of at least 12 characters.");
  }

  const passwordHash = await hashPassword(password);
  await database.execute(
    `INSERT INTO admins (email, password, role)
     VALUES (?, ?, 'ADMIN')`,
    [email, passwordHash],
  );
  console.log(`Created administrator account for ${email}.`);
}

void createAdmin()
  .catch((error: unknown) => {
    console.error("Could not create administrator account:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.end();
  });
