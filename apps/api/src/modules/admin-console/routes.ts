import { Router, type NextFunction, type Request, type Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { Pool, PoolConnection } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import database from "../../config/database";
import { requireAdmin, type AuthenticatedRequest } from "../auth/middleware";
import { calculateOrderAmounts, calculateRedemptionAmounts } from "./financial";

const router = Router();
router.use(requireAdmin);

const ADMIN_DEFAULT_PERMISSIONS: Record<string, boolean> = {
  dashboard: true,
  customers: true,
  products: false,
  orders: true,
  fulfillment: true,
  finance: false,
  reports: false,
  administration: false,
  audit: false,
};

const REPORT_TYPES = ["Payments", "Refunds", "Settlements", "Orders"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

const REPORT_QUERIES: Record<ReportType, string> = {
  Payments: `
    SELECT p.payment_id AS id,
           COALESCE(p.order_id, '') AS reference,
           COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.payment_data, '$.customer')), ''), u.full_name, '') AS party,
           p.method AS category,
           p.amount AS amount,
           p.status AS status,
           DATE_FORMAT(p.created_at, '%Y-%m-%d') AS report_date,
           COALESCE(p.provider_reference, JSON_UNQUOTE(JSON_EXTRACT(p.payment_data, '$.providerRef')), '') AS detail
    FROM admin_payments p
    LEFT JOIN admin_orders o ON o.order_id = p.order_id
    LEFT JOIN users u ON u.user_id = o.customer_user_id`,
  Refunds: `
    SELECT r.refund_id AS id,
           COALESCE(r.payment_id, '') AS reference,
           COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.payment_data, '$.customer')), ''), u.full_name, '') AS party,
           r.reason AS category,
           r.amount AS amount,
           r.status AS status,
           DATE_FORMAT(r.created_at, '%Y-%m-%d') AS report_date,
           COALESCE(r.order_id, p.order_id, '') AS detail
    FROM admin_refunds r
    LEFT JOIN admin_payments p ON p.payment_id = r.payment_id
    LEFT JOIN admin_orders o ON o.order_id = COALESCE(r.order_id, p.order_id)
    LEFT JOIN users u ON u.user_id = o.customer_user_id`,
  Settlements: `
    SELECT s.settlement_id AS id,
           s.provider_reference AS reference,
           s.provider AS party,
           CONCAT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(s.settlement_data, '$.transactions')), ''), '0'), ' entries') AS category,
           s.settled_amount - s.expected_amount AS amount,
           s.status AS status,
           DATE_FORMAT(s.settlement_date, '%Y-%m-%d') AS report_date,
           COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.settlement_data, '$.note')), '') AS detail
    FROM admin_settlements s`,
  Orders: `
    SELECT o.order_id AS id,
           CONCAT('CUS-', o.customer_user_id) AS reference,
           u.full_name AS party,
           CONCAT(o.order_type, ' ', p.metal, ' · ', o.quantity, ' g') AS category,
           o.amount AS amount,
           o.status AS status,
           DATE_FORMAT(o.placed_at, '%Y-%m-%d') AS report_date,
           COALESCE(JSON_UNQUOTE(JSON_EXTRACT(o.order_data, '$.payment')), '') AS detail
    FROM admin_orders o
    INNER JOIN users u ON u.user_id = o.customer_user_id
    INNER JOIN admin_metal_products p ON p.product_id = o.product_id`,
};

const MAX_REPORT_RECORDS = 10_000;

async function readPermissions(roleId: string): Promise<Record<string, boolean>> {
  if (roleId === "SUPER_ADMIN") return Object.fromEntries(Object.keys(ADMIN_DEFAULT_PERMISSIONS).map((key) => [key, true]));
  const permissions = { ...ADMIN_DEFAULT_PERMISSIONS };
  const [rows] = await database.execute<RowDataPacket[]>("SELECT permission_key, allowed FROM admin_role_permissions WHERE role_id = 'ADMIN'");
  for (const row of rows) permissions[String(row.permission_key)] = Boolean(row.allowed);
  return permissions;
}

function requirePermission(permission: string) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = (request as unknown as AuthenticatedRequest).admin;
      const permissions = await readPermissions(actor.roleId);
      if (!permissions[permission]) { response.status(403).json({ message: "You do not have permission to perform this action." }); return; }
      next();
    } catch (error) {
      console.error("Admin permission lookup failed:", error);
      response.status(500).json({ message: "Could not verify admin permissions." });
    }
  };
}

interface JsonRow extends RowDataPacket {
  record_data: unknown;
}

function parseJson<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function customerRecord(row: RowDataPacket): Record<string, unknown> {
  return {
    id: `CUS-${row.user_id}`,
    name: row.full_name,
    email: row.email ?? "",
    phone: row.mobile ?? "",
    city: row.city ?? "",
    pan: row.pan ?? "",
    joined: row.created_at,
    kycStatus: row.verification_status === "VERIFIED" ? "Verified" : row.verification_status === "REJECTED" ? "Rejected" : row.verification_status === "IN_PROGRESS" ? "In review" : "Pending",
    status: row.status === "ACTIVE" ? "Active" : "Suspended",
    transactions: Number(row.transactions ?? 0),
  };
}

function userIdFromCustomerId(customerId: unknown): number {
  if (typeof customerId !== "string" || !/^CUS-\d+$/.test(customerId)) {
    throw new Error("Choose an existing customer.");
  }
  const id = Number(customerId.slice(4));
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Choose an existing customer.");
  return id;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function parseReportType(value: unknown): ReportType {
  const type = REPORT_TYPES.find((candidate) => candidate === value);
  if (type) return type;
  throw new Error("Choose a supported report type.");
}

function reportDate(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be a valid date.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a valid date.`);
  }
  return value;
}

function validateProduct(data: Record<string, unknown>): { name: string; metal: string; purity: string; status: string } {
  const name = requiredString(data.name, "Product name");
  const metal = requiredString(data.metal, "Metal");
  const purity = requiredString(data.purity, "Purity");
  const buyRate = Number(data.buyRate);
  const sellRate = Number(data.sellRate);
  const minOrder = Number(data.minOrder);
  const maxOrder = Number(data.maxOrder);
  if (![buyRate, sellRate, minOrder, maxOrder].every(Number.isFinite) || buyRate <= 0 || sellRate <= 0 || sellRate >= buyRate) {
    throw new Error("Enter positive rates with sell rate lower than buy rate.");
  }
  if (minOrder <= 0 || maxOrder < minOrder) throw new Error("Product amount limits are invalid.");
  for (const key of ["buyChargeBps", "buyTaxBps", "sellChargeBps", "sellTaxBps", "redemptionTaxBps"]) {
    const value = Number(data[key] ?? 0);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Charge and tax rates must be non-negative whole basis points.");
  }
  for (const [minimumKey, maximumKey] of [["minBuyQuantity", "maxBuyQuantity"], ["minSellQuantity", "maxSellQuantity"], ["minRedemptionQuantity", "maxRedemptionQuantity"]]) {
    const minimum = data[minimumKey] ? Number(data[minimumKey]) : null;
    const maximum = data[maximumKey] ? Number(data[maximumKey]) : null;
    if ((minimum !== null && (!Number.isFinite(minimum) || minimum <= 0)) || (maximum !== null && (!Number.isFinite(maximum) || maximum <= 0)) || (minimum !== null && maximum !== null && minimum > maximum)) {
      throw new Error("Product quantity limits are invalid.");
    }
  }
  const redemptionEnabled = data.redemptionEnabled === true;
  if (redemptionEnabled && (!(data.allowCoinDelivery === true || data.allowCashPayout === true) || !data.minRedemptionQuantity || !data.maxRedemptionQuantity)) {
    throw new Error("Enabled redemption requires a fulfillment method and quantity limits.");
  }
  return { name, metal, purity, status: data.status === "Inactive" ? "Inactive" : "Active" };
}

async function availableQuantity(connection: Pool | PoolConnection, userId: number, productId: string): Promise<number> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CASE
       WHEN action IN ('CREDIT', 'RELEASE') THEN quantity
       WHEN action IN ('DEBIT', 'RESERVE') THEN -quantity
       ELSE 0 END), 0) AS available
     FROM admin_metal_ledger WHERE customer_user_id = ? AND product_id = ?`,
    [userId, productId],
  );
  return Number(rows[0]?.available ?? 0);
}

function requestError(response: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Could not save admin data.";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code) {
    console.error("Admin console database write failed:", error);
    response.status(code === "ER_DUP_ENTRY" ? 409 : 500).json({
      message: code === "ER_DUP_ENTRY" ? "A record with this identifier already exists." : "Could not save admin data. Check the database connection and try again.",
    });
    return;
  }
  response.status(message.includes("Duplicate entry") ? 409 : 400).json({ message });
}

function timelineUpdate(data: Record<string, unknown>, status: string, label: string): Record<string, unknown> {
  const timeline = Array.isArray(data.timeline) ? data.timeline as Array<Record<string, unknown>> : [];
  const now = new Date().toISOString();
  return {
    ...data,
    status,
    updatedAt: now,
    timeline: [...timeline, { label, time: now, done: true }],
  };
}

router.get("/state", async (request, response) => {
  try {
    const actor = (request as unknown as AuthenticatedRequest).admin;
    const permissions = await readPermissions(actor.roleId);
    const [products] = await database.execute<JsonRow[]>("SELECT product_data AS record_data FROM admin_metal_products ORDER BY created_at DESC");
    const [rateRequests] = await database.execute<JsonRow[]>("SELECT request_data AS record_data FROM admin_rate_requests ORDER BY requested_at DESC");
    const [makingCharges] = await database.execute<RowDataPacket[]>("SELECT metal, charge_per_gram_paise, enabled, updated_at FROM admin_metal_making_charges ORDER BY metal");
    const [orders] = await database.execute<JsonRow[]>("SELECT order_data AS record_data FROM admin_orders ORDER BY placed_at DESC");
    const [sips] = await database.execute<JsonRow[]>("SELECT sip_data AS record_data FROM admin_sip_plans ORDER BY created_at DESC");
    const [redemptions] = await database.execute<JsonRow[]>("SELECT redemption_data AS record_data FROM admin_redemptions ORDER BY requested_at DESC");
    const [gifts] = await database.execute<JsonRow[]>("SELECT gift_data AS record_data FROM admin_gifts ORDER BY created_at DESC");
    const [payments] = await database.execute<JsonRow[]>("SELECT payment_data AS record_data FROM admin_payments ORDER BY created_at DESC");
    const [refunds] = await database.execute<JsonRow[]>("SELECT refund_data AS record_data FROM admin_refunds ORDER BY created_at DESC");
    const [settlements] = await database.execute<JsonRow[]>("SELECT settlement_data AS record_data FROM admin_settlements ORDER BY settlement_date DESC");
    const [ledgerEntries] = await database.execute<RowDataPacket[]>(
      `SELECT entry_id, customer_user_id, product_id, action, quantity
       FROM admin_metal_ledger ORDER BY entry_id`,
    );
    const [auditRows] = await database.execute<RowDataPacket[]>(
      `SELECT event_id AS id, occurred_at AS timestamp, actor_name AS actor, action, category, target, detail, outcome
       FROM admin_audit_events ORDER BY occurred_at DESC LIMIT 500`,
    );
    const [settingsRows] = await database.execute<RowDataPacket[]>("SELECT settings_data FROM admin_platform_settings WHERE settings_key = 'platform' LIMIT 1");
    const [permissionRows] = await database.execute<RowDataPacket[]>("SELECT role_id, permission_key, allowed FROM admin_role_permissions ORDER BY role_id, permission_key");
    const [roleCounts] = await database.execute<RowDataPacket[]>(
      `SELECT 'ADMIN' AS role_id, COUNT(*) AS users FROM admins
       UNION ALL SELECT 'SUPER_ADMIN' AS role_id, COUNT(*) AS users FROM superadmins`,
    );

    response.json({
      products: (permissions.products ? products : []).map((row) => parseJson(row.record_data)),
      rateRequests: (permissions.products ? rateRequests : []).map((row) => parseJson(row.record_data)),
      metalMakingCharges: (permissions.products ? makingCharges : []).map((row) => ({
        metal: row.metal,
        chargePerGramPaise: Number(row.charge_per_gram_paise),
        enabled: Boolean(row.enabled),
        updatedAt: row.updated_at,
      })),
      orders: (permissions.orders || permissions.reports ? orders : []).map((row) => parseJson(row.record_data)),
      sips: (permissions.orders ? sips : []).map((row) => parseJson(row.record_data)),
      redemptions: (permissions.fulfillment ? redemptions : []).map((row) => parseJson(row.record_data)),
      gifts: (permissions.fulfillment ? gifts : []).map((row) => parseJson(row.record_data)),
      payments: (permissions.finance || permissions.reports ? payments : []).map((row) => parseJson(row.record_data)),
      refunds: (permissions.finance || permissions.reports ? refunds : []).map((row) => parseJson(row.record_data)),
      settlements: (permissions.finance || permissions.reports ? settlements : []).map((row) => parseJson(row.record_data)),
      ledgerEntries: (permissions.customers || permissions.orders || permissions.fulfillment ? ledgerEntries : []).map((row) => ({
        sequence: Number(row.entry_id),
        customerId: `CUS-${row.customer_user_id}`,
        productId: row.product_id,
        action: row.action,
        quantity: String(row.quantity),
      })),
      auditEvents: permissions.audit ? auditRows : [],
      settings: permissions.administration && settingsRows[0] ? parseJson(settingsRows[0].settings_data) : null,
      rolePermissions: permissions.administration ? permissionRows : [],
      roleCounts: Object.fromEntries(roleCounts.map((row) => [row.role_id, Number(row.users)])),
    });
  } catch (error) {
    console.error("Admin console state lookup failed:", error);
    response.status(500).json({ message: "Could not load admin console data." });
  }
});

router.get("/customers", requirePermission("customers"), async (_request, response) => {
  try {
    const [customers] = await database.execute<RowDataPacket[]>(
      `SELECT u.user_id, u.full_name, u.email, u.mobile, u.status, u.verification_status, u.created_at,
              p.city, p.pan,
              (SELECT COUNT(*) FROM admin_orders o WHERE o.customer_user_id = u.user_id) AS transactions
       FROM admin_customer_profiles p
       INNER JOIN users u ON u.user_id = p.user_id
       ORDER BY u.created_at DESC, u.user_id DESC`,
    );
    response.json(customers.map(customerRecord));
  } catch (error) {
    console.error("Admin customer list lookup failed:", error);
    response.status(500).json({ message: "Could not load customer profiles." });
  }
});

router.get("/reports", requirePermission("reports"), async (_request, response) => {
  try {
    const [rows] = await database.execute<RowDataPacket[]>(
      `SELECT report_id AS id, report_type AS type, filters, record_count AS recordCount,
              generated_by_type AS generatedByType, generated_by_id AS generatedById, generated_at AS generatedAt
       FROM admin_reports ORDER BY generated_at DESC, report_id DESC LIMIT 100`,
    );
    response.json(rows.map((row) => ({
      ...row,
      filters: parseJson<Record<string, unknown>>(row.filters),
      recordCount: Number(row.recordCount),
    })));
  } catch (error) {
    console.error("Admin report history lookup failed:", error);
    response.status(500).json({ message: "Could not load report history." });
  }
});

router.post("/reports", requirePermission("reports"), async (request, response) => {
  try {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      throw new Error("Report filters must be an object.");
    }
    const body = request.body as Record<string, unknown>;
    const type = parseReportType(body.type);
    if (body.status !== undefined && typeof body.status !== "string") throw new Error("Status must be text.");
    if (body.search !== undefined && typeof body.search !== "string") throw new Error("Search text must be text.");
    const statusValue = typeof body.status === "string" ? body.status.trim() : "";
    const status = statusValue === "All statuses" ? "" : statusValue;
    const search = typeof body.search === "string" ? body.search.trim() : "";
    const startDate = reportDate(body.startDate, "Start date");
    const endDate = reportDate(body.endDate, "End date");
    if (search.length > 160) throw new Error("Search text must be 160 characters or fewer.");
    if (startDate && endDate && startDate > endDate) throw new Error("Start date must be on or before end date.");

    const conditions: string[] = [];
    const parameters: Array<string | number> = [];
    if (status) {
      conditions.push("report.status = ?");
      parameters.push(status);
    }
    if (startDate) {
      conditions.push("report.report_date >= ?");
      parameters.push(startDate);
    }
    if (endDate) {
      conditions.push("report.report_date <= ?");
      parameters.push(endDate);
    }
    if (search) {
      conditions.push("LOCATE(LOWER(?), LOWER(CONCAT_WS(' ', report.id, report.reference, report.party, report.category, report.status, report.detail))) > 0");
      parameters.push(search);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await database.execute<RowDataPacket[]>(
      `SELECT report.id, report.reference, report.party, report.category, report.amount, report.status,
              report.report_date AS date, report.detail
       FROM (${REPORT_QUERIES[type]}) AS report
       ${where}
       ORDER BY report.report_date DESC, report.id DESC
       LIMIT ?`,
      [...parameters, MAX_REPORT_RECORDS + 1],
    );
    if (rows.length > MAX_REPORT_RECORDS) {
      response.status(413).json({ message: `Narrow the filters to export no more than ${MAX_REPORT_RECORDS} records.` });
      return;
    }

    const actor = (request as unknown as AuthenticatedRequest).admin;
    const reportId = `RPT-${randomUUID().toUpperCase()}`;
    const filters = { status: status || "All statuses", search, startDate, endDate };
    await database.execute(
      `INSERT INTO admin_reports (report_id, report_type, filters, record_count, generated_by_type, generated_by_id, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [reportId, type, JSON.stringify(filters), rows.length, actor.roleId === "SUPER_ADMIN" ? "superadmin" : "admin", actor.id],
    );
    response.json({
      report: { id: reportId, type, filters, recordCount: rows.length, generatedAt: new Date().toISOString() },
      rows: rows.map((row) => ({ ...row, amount: Number(row.amount), date: String(row.date) })),
    });
  } catch (error) {
    requestError(response, error);
  }
});

router.post("/customers", requirePermission("customers"), async (request, response) => {
  const customer = request.body as Record<string, unknown>;
  let connection: PoolConnection | undefined;
  try {
    connection = await database.getConnection();
    const name = requiredString(customer.name, "Name");
    const email = requiredString(customer.email, "Email").toLowerCase();
    const phone = requiredString(customer.phone, "Phone").replace(/\s+/g, "");
    if (!/^\+?[0-9]{10,15}$/.test(phone)) {
      throw new Error("Enter a phone number with 10 to 15 digits.");
    }
    const city = requiredString(customer.city, "City");
    const pan = requiredString(customer.pan, "PAN").toUpperCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) throw new Error("Enter a valid PAN.");
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO users (full_name, mobile, email, status, verification_status)
       VALUES (?, ?, ?, 'ACTIVE', 'PENDING')`,
      [name, phone, email],
    );
    const userId = Number(result.insertId);
    await connection.execute(
      "INSERT INTO admin_customer_profiles (user_id, city, pan) VALUES (?, ?, ?)",
      [userId, city, pan],
    );
    await connection.execute(
      "INSERT INTO user_verification (user_id, verification_type, status) VALUES (?, 'ADMIN_REVIEW', 'PENDING')",
      [userId],
    );
    const [createdCustomers] = await connection.execute<RowDataPacket[]>(
      `SELECT u.user_id, u.full_name, u.email, u.mobile, u.status, u.verification_status, u.created_at,
              p.city, p.pan, 0 AS transactions
       FROM admin_customer_profiles p
       INNER JOIN users u ON u.user_id = p.user_id
       WHERE u.user_id = ? LIMIT 1`,
      [userId],
    );
    if (!createdCustomers[0]) throw new Error("Customer profile was not created.");
    await connection.commit();
    response.status(201).json(customerRecord(createdCustomers[0]));
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError: unknown) => {
        console.error("Customer creation rollback failed:", rollbackError);
      });
    }
    requestError(response, error);
  } finally {
    connection?.release();
  }
});

router.patch("/customers/:customerId", requirePermission("customers"), async (request, response) => {
  try {
    const userId = userIdFromCustomerId(request.params.customerId);
    const updates = request.body as Record<string, unknown>;
    const [users] = await database.execute<RowDataPacket[]>("SELECT user_id FROM users WHERE user_id = ? LIMIT 1", [userId]);
    if (!users[0]) { response.status(404).json({ message: "Customer was not found." }); return; }
    if (typeof updates.status === "string") {
      await database.execute("UPDATE users SET status = ? WHERE user_id = ?", [updates.status === "Active" ? "ACTIVE" : "INACTIVE", userId]);
    }
    if (typeof updates.kycStatus === "string") {
      const status = updates.kycStatus === "Verified" ? "VERIFIED" : updates.kycStatus === "Rejected" ? "REJECTED" : "PENDING";
      await database.execute("UPDATE users SET verification_status = ? WHERE user_id = ?", [status, userId]);
      await database.execute("INSERT INTO user_verification (user_id, verification_type, status) VALUES (?, 'ADMIN_REVIEW', ?)", [userId, status]);
    }
    if (typeof updates.city === "string" || typeof updates.pan === "string") {
      const [profiles] = await database.execute<RowDataPacket[]>("SELECT city, pan FROM admin_customer_profiles WHERE user_id = ? LIMIT 1", [userId]);
      await database.execute(
        `INSERT INTO admin_customer_profiles (user_id, city, pan) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE city = VALUES(city), pan = VALUES(pan)`,
        [userId, typeof updates.city === "string" ? updates.city : profiles[0]?.city ?? "", typeof updates.pan === "string" ? updates.pan : profiles[0]?.pan ?? null],
      );
    }
    response.json({ success: true });
  } catch (error) { requestError(response, error); }
});

router.post("/products", requirePermission("products"), async (request, response) => {
  try {
    const data = request.body as Record<string, unknown>;
    const id = requiredString(data.id, "Product ID");
    const { name, metal, purity, status } = validateProduct(data);
    await database.execute(
      `INSERT INTO admin_metal_products (product_id, name, metal, purity, status, product_data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, metal, purity, status, JSON.stringify(data)],
    );
    response.status(201).json(data);
  } catch (error) { requestError(response, error); }
});

router.put("/products/:productId", requirePermission("products"), async (request, response) => {
  try {
    const data = request.body as Record<string, unknown>;
    const product = validateProduct(data);
    const [result] = await database.execute(
      `UPDATE admin_metal_products SET name = ?, metal = ?, purity = ?, status = ?, product_data = ?
       WHERE product_id = ?`,
      [product.name, product.metal, product.purity, product.status, JSON.stringify(data), request.params.productId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) { response.status(404).json({ message: "Product was not found." }); return; }
    response.json(data);
  } catch (error) { requestError(response, error); }
});

router.put("/making-charges/:metal", async (request, response) => {
  const actor = (request as unknown as AuthenticatedRequest).admin;
  if (actor.roleId !== "SUPER_ADMIN") { response.status(403).json({ message: "Only Super Admin can update making charges." }); return; }
  try {
    const { chargePerGramPaise, enabled } = request.body as { chargePerGramPaise: number; enabled: boolean };
    if (!Number.isSafeInteger(chargePerGramPaise) || chargePerGramPaise < 0 || typeof enabled !== "boolean") throw new Error("Invalid making-charge settings.");
    await database.execute(
      `INSERT INTO admin_metal_making_charges (metal, charge_per_gram_paise, enabled) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE charge_per_gram_paise = VALUES(charge_per_gram_paise), enabled = VALUES(enabled)`,
      [request.params.metal, chargePerGramPaise, enabled],
    );
    response.json({ success: true });
  } catch (error) { requestError(response, error); }
});

router.post("/rate-requests", requirePermission("products"), async (request, response) => {
  try {
    const data = request.body as Record<string, unknown>;
    const buyRate = Number(data.buyRate);
    const sellRate = Number(data.sellRate);
    if (!Number.isFinite(buyRate) || !Number.isFinite(sellRate) || buyRate <= 0 || sellRate <= 0 || sellRate >= buyRate) {
      throw new Error("Enter positive rates with sell rate lower than buy rate.");
    }
    const [products] = await database.execute<RowDataPacket[]>(
      "SELECT product_id FROM admin_metal_products WHERE metal = ? AND purity = ? LIMIT 1",
      [requiredString(data.metal, "Metal"), requiredString(data.purity, "Purity")],
    );
    if (!products[0]) { response.status(400).json({ message: "Rate request product was not found." }); return; }
    await database.execute(
      `INSERT INTO admin_rate_requests (request_id, product_id, status, requested_by, requested_at, request_data)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
      [requiredString(data.id, "Request ID"), products[0].product_id, data.status ?? "Pending", data.requestedBy ?? "Admin", JSON.stringify(data)],
    );
    response.status(201).json(data);
  } catch (error) { requestError(response, error); }
});

router.patch("/rate-requests/:requestId", requirePermission("products"), async (request, response) => {
  try {
    const status = requiredString(request.body.status, "Status");
    const [rows] = await database.execute<RowDataPacket[]>("SELECT product_id, request_data FROM admin_rate_requests WHERE request_id = ? LIMIT 1", [request.params.requestId]);
    if (!rows[0]) { response.status(404).json({ message: "Rate request was not found." }); return; }
    const data = parseJson<Record<string, unknown>>(rows[0].request_data);
    data.status = status;
    await database.execute("UPDATE admin_rate_requests SET status = ?, request_data = ? WHERE request_id = ?", [status, JSON.stringify(data), request.params.requestId]);
    if (status === "Approved") {
      const [productRows] = await database.execute<JsonRow[]>("SELECT product_data AS record_data FROM admin_metal_products WHERE product_id = ?", [rows[0].product_id]);
      if (productRows[0]) {
        const product = parseJson<Record<string, unknown>>(productRows[0].record_data);
        product.buyRate = data.buyRate;
        product.sellRate = data.sellRate;
        await database.execute("UPDATE admin_metal_products SET product_data = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?", [JSON.stringify(product), rows[0].product_id]);
      }
    }
    response.json({ success: true });
  } catch (error) { requestError(response, error); }
});

router.post("/orders", requirePermission("orders"), async (request, response) => {
  const connection = await database.getConnection();
  try {
    const data = request.body as Record<string, unknown>;
    const userId = userIdFromCustomerId(data.customerId);
    const productId = requiredString(data.productId, "Product");
    const orderId = requiredString(data.id, "Order ID");
    await connection.beginTransaction();
    const type = requiredString(data.type, "Order type");
    if (data.status !== "Pending") throw new Error("New orders must begin in Pending status.");
    const status = "Pending";
    const paymentMethod = requiredString(data.payment, "Payment method");
    const [productRows] = await connection.execute<JsonRow[]>("SELECT status, product_data AS record_data FROM admin_metal_products WHERE product_id = ? LIMIT 1", [productId]);
    if (!productRows[0] || productRows[0].status !== "Active") throw new Error("Choose an active metal product.");
    const product = parseJson<Record<string, unknown>>(productRows[0].record_data);
    const [makingChargeRows] = await connection.execute<RowDataPacket[]>("SELECT charge_per_gram_paise, enabled FROM admin_metal_making_charges WHERE metal = ? LIMIT 1", [String(product.metal)]);
    const pricedOrder = calculateOrderAmounts({ ...data, type }, product, Number(makingChargeRows[0]?.charge_per_gram_paise ?? 0), Boolean(makingChargeRows[0]?.enabled));
    const quantity = Number(pricedOrder.quantity);
    const amount = Number(pricedOrder.amount);
    if (type === "Sell") await connection.execute("SELECT user_id FROM users WHERE user_id = ? FOR UPDATE", [userId]);
    if (type === "Sell" && quantity > await availableQuantity(connection, userId, productId)) throw new Error("Sell quantity exceeds the customer's available metal balance.");
    await connection.execute(
      `INSERT INTO admin_orders (order_id, customer_user_id, product_id, order_type, status, quantity, amount, placed_at, order_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
      [orderId, userId, productId, type, status, quantity, amount, JSON.stringify(pricedOrder)],
    );
    if (type === "Sell") {
      await connection.execute(
        `INSERT IGNORE INTO admin_metal_ledger (customer_user_id, product_id, reference_type, reference_id, action, quantity)
         VALUES (?, ?, 'ORDER', ?, 'RESERVE', ?)`,
        [userId, productId, orderId, quantity],
      );
    }
    const paymentId = `PAY-${randomUUID()}`;
    const payment = { id: paymentId, orderId, customer: data.customer, method: paymentMethod, amount, currency: "INR", providerRef: "", status: "Pending", date: new Date().toISOString().slice(0, 10), time: new Date().toISOString().slice(11, 19) };
    await connection.execute(
      `INSERT INTO admin_payments (payment_id, order_id, status, method, amount, provider_reference, payment_data)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      [paymentId, orderId, "Pending", paymentMethod, amount, JSON.stringify(payment)],
    );
    await connection.commit();
    response.status(201).json({ order: pricedOrder, payment });
  } catch (error) { await connection.rollback(); requestError(response, error); }
  finally { connection.release(); }
});

router.patch("/orders/:orderId", requirePermission("orders"), async (request, response) => updateTimelineRecord(response, "admin_orders", "order_id", "order_data", "Order", String(request.params.orderId), request.body.status));
router.post("/sips", requirePermission("orders"), async (request, response) => createRelatedRecord(response, "admin_sip_plans", request.body));
router.patch("/sips/:sipId", requirePermission("orders"), async (request, response) => updateTimelineRecord(response, "admin_sip_plans", "sip_id", "sip_data", "SIP plan", String(request.params.sipId), request.body.status));
router.post("/redemptions", requirePermission("fulfillment"), async (request, response) => createRelatedRecord(response, "admin_redemptions", request.body));
router.patch("/redemptions/:redemptionId", requirePermission("fulfillment"), async (request, response) => updateTimelineRecord(response, "admin_redemptions", "redemption_id", "redemption_data", "Redemption", String(request.params.redemptionId), request.body.status));
router.post("/gifts", requirePermission("fulfillment"), async (request, response) => createRelatedRecord(response, "admin_gifts", request.body));
router.patch("/gifts/:giftId", requirePermission("fulfillment"), async (request, response) => updateTimelineRecord(response, "admin_gifts", "gift_id", "gift_data", "Gift", String(request.params.giftId), request.body.status));
router.post("/gifts/:giftId/actions", requirePermission("fulfillment"), async (request, response) => {
  try {
    if (request.body.action !== "resend") throw new Error("Unsupported gift action.");
    const [rows] = await database.execute<JsonRow[]>("SELECT gift_data AS record_data FROM admin_gifts WHERE gift_id = ? LIMIT 1", [request.params.giftId]);
    if (!rows[0]) { response.status(404).json({ message: "Gift was not found." }); return; }
    const current = parseJson<Record<string, unknown>>(rows[0].record_data);
    if (current.status !== "Delivered") { response.status(409).json({ message: "Only delivered gifts can be resent." }); return; }
    const data = timelineUpdate(current, "Delivered", "Gift email resend recorded");
    await database.execute("UPDATE admin_gifts SET gift_data = ? WHERE gift_id = ?", [JSON.stringify(data), request.params.giftId]);
    response.json({ success: true });
  } catch (error) { requestError(response, error); }
});

router.post("/audit-events", async (request, response) => {
  try {
    const actor = (request as unknown as AuthenticatedRequest).admin;
    const event = request.body as Record<string, unknown>;
    await database.execute(
      `INSERT INTO admin_audit_events (event_id, actor_account_type, admin_id, superadmin_id, actor_name, action, category, target, detail, outcome, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [requiredString(event.id, "Audit event ID"), actor.roleId === "SUPER_ADMIN" ? "superadmin" : "admin", actor.roleId === "SUPER_ADMIN" ? null : actor.id, actor.roleId === "SUPER_ADMIN" ? actor.id : null, requiredString(event.actor, "Actor"), requiredString(event.action, "Action"), requiredString(event.category, "Category"), requiredString(event.target, "Target"), typeof event.detail === "string" ? event.detail : "", typeof event.outcome === "string" ? event.outcome : "Completed"],
    );
    response.status(201).json({ success: true });
  } catch (error) { requestError(response, error); }
});

router.put("/settings", requirePermission("administration"), async (request, response) => {
  const actor = (request as unknown as AuthenticatedRequest).admin;
  if (actor.roleId !== "SUPER_ADMIN") { response.status(403).json({ message: "Only Super Admin can update platform settings." }); return; }
  try {
    await database.execute(
      `INSERT INTO admin_platform_settings (settings_key, settings_data, updated_by_type, updated_by_id)
       VALUES ('platform', ?, ?, ?)
       ON DUPLICATE KEY UPDATE settings_data = VALUES(settings_data), updated_by_type = VALUES(updated_by_type), updated_by_id = VALUES(updated_by_id)`,
      [JSON.stringify(request.body), "superadmin", actor.id],
    );
    response.json({ success: true });
  } catch (error) { requestError(response, error); }
});

router.put("/roles/:roleId/permissions", requirePermission("administration"), async (request, response) => {
  const actor = (request as unknown as AuthenticatedRequest).admin;
  if (actor.roleId !== "SUPER_ADMIN") { response.status(403).json({ message: "Only Super Admin can update role permissions." }); return; }
  try {
    const permissions = request.body as Record<string, unknown>;
    const connection = await database.getConnection();
    try {
      await connection.beginTransaction();
      for (const [key, allowed] of Object.entries(permissions)) {
        if (typeof allowed !== "boolean") throw new Error("Each permission must be enabled or disabled.");
        await connection.execute(
          `INSERT INTO admin_role_permissions (role_id, permission_key, allowed) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)`,
          [request.params.roleId, key, allowed],
        );
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    response.json({ success: true });
  } catch (error) { requestError(response, error); }
});

router.patch("/refunds/:refundId", requirePermission("finance"), async (request, response) => updateJsonStatus(response, "admin_refunds", "refund_id", "refund_data", String(request.params.refundId), request.body.status));
router.patch("/settlements/:settlementId", requirePermission("finance"), async (request, response) => updateJsonStatus(response, "admin_settlements", "settlement_id", "settlement_data", String(request.params.settlementId), request.body.status));

router.post("/refunds", requirePermission("finance"), async (request, response) => {
  try {
    const data = request.body as Record<string, unknown>;
    const id = requiredString(data.id, "Refund ID");
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Refund amount must be positive.");
    const paymentId = typeof data.paymentId === "string" && data.paymentId ? data.paymentId : null;
    const orderId = typeof data.orderId === "string" && data.orderId ? data.orderId : null;
    await database.execute(
      `INSERT INTO admin_refunds (refund_id, payment_id, order_id, status, amount, reason, refund_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, paymentId, orderId, requiredString(data.status, "Status"), amount, requiredString(data.reason, "Reason"), JSON.stringify(data)],
    );
    response.status(201).json(data);
  } catch (error) { requestError(response, error); }
});

router.post("/settlements", requirePermission("finance"), async (request, response) => {
  try {
    const data = request.body as Record<string, unknown>;
    const expected = Number(data.expected);
    const settled = Number(data.settled);
    if (![expected, settled].every(Number.isFinite) || expected < 0 || settled < 0) throw new Error("Settlement amounts must be non-negative.");
    const settlementDate = typeof data.date === "string" ? new Date(data.date) : null;
    if (!settlementDate || Number.isNaN(settlementDate.getTime())) throw new Error("Settlement date is invalid.");
    await database.execute(
      `INSERT INTO admin_settlements (settlement_id, provider, provider_reference, status, expected_amount, settled_amount, settlement_data, settlement_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [requiredString(data.id, "Settlement ID"), requiredString(data.provider, "Provider"), requiredString(data.settlementRef, "Provider reference"), requiredString(data.status, "Status"), expected, settled, JSON.stringify(data), settlementDate.toISOString().slice(0, 10)],
    );
    response.status(201).json(data);
  } catch (error) { requestError(response, error); }
});

async function createRelatedRecord(
  response: Response,
  table: "admin_sip_plans" | "admin_redemptions" | "admin_gifts",
  body: unknown,
): Promise<void> {
  try {
    const data = body as Record<string, unknown>;
    const id = requiredString(data.id, "Record ID");
    const userId = userIdFromCustomerId(data.customerId ?? data.senderId);
    const productId = requiredString(data.productId, "Product");
    const status = requiredString(data.status, "Status");
    let amount = Number(data.amount);
    let persistedData = data;
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Amount must be a valid non-negative value.");
    const [productRows] = await database.execute<JsonRow[]>("SELECT status, product_data AS record_data FROM admin_metal_products WHERE product_id = ? LIMIT 1", [productId]);
    if (!productRows[0] || productRows[0].status !== "Active") throw new Error("Choose an active metal product.");
    const product = parseJson<Record<string, unknown>>(productRows[0].record_data);
    if (amount < Number(product.minOrder) || amount > Number(product.maxOrder)) throw new Error("Amount is outside this product's configured limits.");
    if (table === "admin_sip_plans") {
      const frequency = requiredString(data.frequency, "Frequency");
      if (!["Weekly", "Monthly"].includes(frequency)) throw new Error("Choose a supported SIP frequency.");
      const nextDebit = typeof data.nextDebit === "string" ? data.nextDebit.slice(0, 10) : null;
      if (!nextDebit || Number.isNaN(Date.parse(nextDebit))) throw new Error("Choose a valid SIP debit date.");
      await database.execute(
        `INSERT INTO admin_sip_plans (sip_id, customer_user_id, product_id, status, amount, frequency, next_debit, sip_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, productId, status, amount, frequency, nextDebit, JSON.stringify(data)],
      );
    } else if (table === "admin_redemptions") {
      persistedData = calculateRedemptionAmounts(data, product);
      const quantity = Number(persistedData.quantity);
      amount = Number(persistedData.amount);
      const mode = requiredString(data.mode, "Fulfillment mode");
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantity must be positive.");
      const allowedMode = mode === "Coin delivery" ? product.allowCoinDelivery === true : mode === "Cash payout" && product.allowCashPayout === true;
      if (product.redemptionEnabled !== true || !allowedMode) throw new Error("Redemption is not enabled for this product and fulfillment method.");
      const minRedemption = Number(product.minRedemptionQuantity);
      const maxRedemption = Number(product.maxRedemptionQuantity);
      if (!Number.isFinite(minRedemption) || !Number.isFinite(maxRedemption) || quantity < minRedemption || quantity > maxRedemption) throw new Error("Redemption quantity is outside the configured limits.");
      if (mode === "Coin delivery" && (typeof data.address !== "string" || data.address.trim().length < 12)) throw new Error("Enter a complete delivery address.");
      const connection = await database.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute("SELECT user_id FROM users WHERE user_id = ? FOR UPDATE", [userId]);
        if (quantity > await availableQuantity(connection, userId, productId)) throw new Error("Redemption quantity exceeds the customer's available metal balance.");
        await connection.execute(
          `INSERT INTO admin_redemptions (redemption_id, customer_user_id, product_id, status, fulfillment_mode, quantity, amount, tracking, requested_at, redemption_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
          [id, userId, productId, status, mode, quantity, amount, typeof data.tracking === "string" && data.tracking !== "—" ? data.tracking : null, JSON.stringify(persistedData)],
        );
        await connection.execute(
          `INSERT IGNORE INTO admin_metal_ledger (customer_user_id, product_id, reference_type, reference_id, action, quantity)
           VALUES (?, ?, 'REDEMPTION', ?, 'RESERVE', ?)`,
          [userId, productId, id, quantity],
        );
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    } else {
      const recipientEmail = requiredString(data.recipientEmail, "Recipient email");
      const parsedDate = typeof data.deliveryDate === "string" ? new Date(data.deliveryDate) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) throw new Error("Delivery date is invalid.");
      const date = parsedDate.toISOString().slice(0, 10);
      await database.execute(
        `INSERT INTO admin_gifts (gift_id, sender_user_id, product_id, recipient_email, status, amount, delivery_date, gift_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, productId, recipientEmail, status, amount, date, JSON.stringify(data)],
      );
    }
    response.status(201).json(persistedData);
  } catch (error) { requestError(response, error); }
}

async function updateTimelineRecord(
  response: Response,
  table: "admin_orders" | "admin_sip_plans" | "admin_redemptions" | "admin_gifts",
  idColumn: "order_id" | "sip_id" | "redemption_id" | "gift_id",
  dataColumn: "order_data" | "sip_data" | "redemption_data" | "gift_data",
  label: string,
  id: string,
  nextStatus: unknown,
): Promise<void> {
  const connection = await database.getConnection();
  try {
    const status = requiredString(nextStatus, "Status");
    await connection.beginTransaction();
    const extraColumns = table === "admin_orders"
      ? ", order_type, customer_user_id, product_id, quantity"
      : table === "admin_redemptions"
        ? ", customer_user_id, product_id, quantity"
        : "";
    const [rows] = await connection.execute<JsonRow[]>(`SELECT ${dataColumn} AS record_data, status${extraColumns} FROM ${table} WHERE ${idColumn} = ? LIMIT 1`, [id]);
    if (!rows[0]) { await connection.rollback(); response.status(404).json({ message: `${label} was not found.` }); return; }
    const currentStatus = String(rows[0].status);
    if (currentStatus === status) { await connection.commit(); response.json({ success: true }); return; }
    const transitions: Record<string, Record<string, string[]>> = {
      admin_orders: { Pending: ["Processing", "Failed", "Cancelled"], Processing: ["Completed", "Failed", "Cancelled"] },
      admin_sip_plans: { Active: ["Paused", "Cancelled", "Completed"], Paused: ["Active", "Cancelled"] },
      admin_redemptions: { Pending: ["Processing", "Rejected"], Processing: ["Shipped", "Completed", "Rejected"], Shipped: ["Delivered"] },
      admin_gifts: { Scheduled: ["Cancelled"], Delivered: ["Cancelled"], Redeemed: [], Expired: [], Cancelled: [] },
    };
    if (!transitions[table][currentStatus]?.includes(status)) {
      await connection.rollback();
      response.status(409).json({ message: `Cannot change ${label.toLowerCase()} from ${currentStatus} to ${status}.` });
      return;
    }
    const updated = timelineUpdate(parseJson<Record<string, unknown>>(rows[0].record_data), status, `${label} ${status.toLowerCase()}`);
    if (table === "admin_redemptions" && status === "Shipped" && updated.tracking === "—") {
      updated.tracking = `AWB-${randomUUID().slice(0, 8).toUpperCase()}`;
    }
    await connection.execute(`UPDATE ${table} SET status = ?, ${dataColumn} = ? WHERE ${idColumn} = ?`, [status, JSON.stringify(updated), id]);
    if (table === "admin_orders") {
      let action: string | null = null;
      if (rows[0].order_type === "Buy" && status === "Completed") action = "CREDIT";
      else if (rows[0].order_type === "Sell" && status === "Completed") action = "CONSUME_RESERVATION";
      else if (rows[0].order_type === "Sell" && ["Failed", "Cancelled"].includes(status)) action = "RELEASE";
      if (action) {
        await connection.execute(
          `INSERT IGNORE INTO admin_metal_ledger (customer_user_id, product_id, reference_type, reference_id, action, quantity)
           VALUES (?, ?, 'ORDER', ?, ?, ?)`,
          [Number(rows[0].customer_user_id), String(rows[0].product_id), id, action, Number(rows[0].quantity)],
        );
      }
    }
    if (table === "admin_redemptions") {
      const action = ["Delivered", "Completed"].includes(status)
        ? "CONSUME_RESERVATION"
        : status === "Rejected" ? "RELEASE" : null;
      if (action) {
        await connection.execute(
          `INSERT IGNORE INTO admin_metal_ledger (customer_user_id, product_id, reference_type, reference_id, action, quantity)
           VALUES (?, ?, 'REDEMPTION', ?, ?, ?)`,
          [Number(rows[0].customer_user_id), String(rows[0].product_id), id, action, Number(rows[0].quantity)],
        );
      }
    }
    let payment: Record<string, unknown> | null = null;
    if (table === "admin_orders" && ["Completed", "Failed", "Cancelled"].includes(status)) {
      const paymentStatus = status === "Completed" ? "Successful" : "Failed";
      const [paymentRows] = await connection.execute<JsonRow[]>("SELECT payment_id, payment_data AS record_data FROM admin_payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1", [id]);
      if (paymentRows[0]) {
        payment = parseJson<Record<string, unknown>>(paymentRows[0].record_data);
        payment.status = paymentStatus;
        await connection.execute("UPDATE admin_payments SET status = ?, payment_data = ? WHERE payment_id = ?", [paymentStatus, JSON.stringify(payment), paymentRows[0].payment_id]);
      }
    }
    await connection.commit();
    response.json({ success: true, payment, data: updated });
  } catch (error) { await connection.rollback(); requestError(response, error); }
  finally { connection.release(); }
}

async function updateJsonStatus(
  response: Response,
  table: "admin_refunds" | "admin_settlements",
  idColumn: "refund_id" | "settlement_id",
  dataColumn: "refund_data" | "settlement_data",
  id: string,
  nextStatus: unknown,
): Promise<void> {
  try {
    const status = requiredString(nextStatus, "Status");
    const [rows] = await database.execute<JsonRow[]>(`SELECT ${dataColumn} AS record_data FROM ${table} WHERE ${idColumn} = ? LIMIT 1`, [id]);
    if (!rows[0]) { response.status(404).json({ message: "Record was not found." }); return; }
    const data = parseJson<Record<string, unknown>>(rows[0].record_data);
    data.status = status;
    data.reviewedAt = new Date().toISOString();
    await database.execute(`UPDATE ${table} SET status = ?, ${dataColumn} = ? WHERE ${idColumn} = ?`, [status, JSON.stringify(data), id]);
    response.json({ success: true });
  } catch (error) { requestError(response, error); }
}

export default router;