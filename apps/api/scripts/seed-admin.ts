import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import database from "../src/config/database";
import { hashPassword } from "../src/modules/auth/credentials";

const ADMIN_EMAIL = "admin@digitalgold.demo";
const ADMIN_PASSWORD = "Admin123!";

async function seedAdmin(): Promise<void> {
  const schema = readFileSync(
    resolve(__dirname, "../src/modules/auth/schema.sql"),
    "utf8",
  );
  for (const statement of schema.split(";").map((part) => part.trim()).filter(Boolean)) {
    await database.query(statement);
  }

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await database.execute(
    `INSERT INTO admins (email, password, role)
     VALUES (?, ?, 'ADMIN')
     ON DUPLICATE KEY UPDATE
       role = VALUES(role),
       password = VALUES(password)`,
    [ADMIN_EMAIL, passwordHash],
  );
  console.log(`Seeded demo administrator ${ADMIN_EMAIL}.`);
}

void seedAdmin()
  .catch((error: unknown) => {
    console.error("Could not seed the demo administrator:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.end();
  });
