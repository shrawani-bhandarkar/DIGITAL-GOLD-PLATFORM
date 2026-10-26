import cors from "cors";
import express from "express";
import database from "./config/database";
import adminRouter from "./modules/auth/protected-routes";
import authRouter from "./modules/auth/routes";
import adminConsoleRouter from "./modules/admin-console/routes";
import customerAuthRouter, { customerProfileRouter } from "./modules/customer-auth/routes";
import customerActivityRouter from "./modules/customer-activity/routes";
import customerOrdersRouter from "./modules/customer-orders/routes";
import marketRatesRouter from "./modules/rates/routes";
import metalPricesRouter from "./modules/metal-prices/routes";

const app = express();

app.use(
  cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/customer/auth", customerAuthRouter);
app.use("/api/customer/me", customerProfileRouter);
app.use("/api/customer/orders", customerOrdersRouter);
app.use("/api/customer", customerActivityRouter);
app.use("/api/market", marketRatesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin/metal-prices", metalPricesRouter);
app.use("/api/admin/console", adminConsoleRouter);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/health/db", async (_request, response) => {
  try {
    await database.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error);
    response.status(503).json({ status: "error", database: "disconnected" });
  }
});

export default app;
