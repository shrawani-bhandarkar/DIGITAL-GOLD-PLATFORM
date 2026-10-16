import { createPool } from "mysql2/promise";
import { z } from "zod";

const databaseConfigSchema = z.object({
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z.string().min(1).default("digital_gold_db"),
});

const config = databaseConfigSchema.parse(process.env);

const database = createPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default database;
