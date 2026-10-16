import "dotenv/config";
import app from "./app";
import database from "./config/database";

const port = Number(process.env.PORT ?? 4000);

async function startServer(): Promise<void> {
  await database.query("SELECT 1");

  app.listen(port, () => {
    console.log(`Digi Gold API listening on http://localhost:${port}`);
  });
}

void startServer().catch((error: unknown) => {
  console.error("Failed to connect to MySQL; API server was not started:", error);
  process.exitCode = 1;
});
