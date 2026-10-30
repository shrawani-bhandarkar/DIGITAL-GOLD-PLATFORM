import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { Pool, PoolConnection } from "mysql2/promise";
import database from "../../config/database";
import { AuthenticatedCustomerRequest, requireApprovedKyc, requireCustomer } from "../customer-auth/middleware";
import { addSipMonths, buildSipSchedule, divideRounded, type SipFrequency } from "../sip/schedule";

const router = Router();
const DEFAULT_ACTIVITY_LIMIT = 20;
const MAX_ACTIVITY_LIMIT = 50;

interface CustomerActivityRecord extends RowDataPacket {
  id: string;
  type: string;
  metal: string;
  quantityGrams: string | number | null;
  amount: string | number;
  createdAt: Date | string;
  status: string;
}

function moneyToPaise(value: unknown, label: string): bigint {
  const text = typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,18}(?:\.\d{1,2})?$/.test(text)) throw new Error(`${label} is invalid.`);
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function formatPaise(value: bigint): string {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

function customerSchemeRecord(row: RowDataPacket): Record<string, unknown> {
  const chargeType = String(row.charge_type);
  const chargeValue = Number(row.charge_value);
  const chargeValuePaise = moneyToPaise(String(row.charge_value), "SIP charge");
  const minimumAmountPaise = moneyToPaise(String(row.minimum_amount), "Minimum investment");
  const chargePaise = chargeType === "fixed"
    ? chargeValuePaise
    : divideRounded(minimumAmountPaise * chargeValuePaise, 10_000n);
  const taxPaise = divideRounded(chargePaise * BigInt(Number(row.tax_rate_bps)), 10_000n);
  return {
    id: row.scheme_id,
    name: row.scheme_name,
    productId: row.product_id,
    metal: row.metal,
    purity: row.purity,
    minimumAmount: Number(row.minimum_amount),
    frequency: row.frequency,
    durationMonths: Number(row.duration_months),
    chargeType,
    chargeValue,
    taxRateBps: Number(row.tax_rate_bps),
    estimatedInstallmentCharge: Number(formatPaise(chargePaise)),
    estimatedInstallmentTax: Number(formatPaise(taxPaise)),
    estimatedInstallmentTotal: Number(formatPaise(minimumAmountPaise + chargePaise + taxPaise)),
    status: row.status,
    source: "scheme",
    enrollable: true,
  };
}

function customerAdminPlanRecord(row: RowDataPacket): Record<string, unknown> {
  const monthlyAmountPaise = moneyToPaise(String(row.monthly_amount), "Monthly payment");
  return {
    id: row.sip_id,
    name: `${row.metal} SIP`,
    productId: row.product_id,
    metal: row.metal,
    purity: row.purity,
    minimumAmount: Number(row.monthly_amount),
    durationMonths: Number(row.duration_months) + Number(row.shop_owner_contribution_months),
    chargeType: "fixed",
    chargeValue: Number(row.monthly_amount),
    estimatedInstallmentCharge: Number(formatPaise(monthlyAmountPaise)),
    estimatedInstallmentTotal: Number(row.total_investment),
    shopOwnerMonthlyContribution: Number(row.shop_owner_monthly_contribution),
    shopOwnerContributionMonths: Number(row.shop_owner_contribution_months),
    totalShopOwnerContribution: Number(row.total_shop_owner_contribution),
    totalCustomerPayments: Number(row.total_customer_payments),
    totalInvestment: Number(row.total_investment),
    status: row.status,
    source: "admin-plan",
    enrollable: true,
  };
}

function customerInstallmentRecord(row: RowDataPacket): Record<string, unknown> {
  return {
    number: Number(row.installment_number),
    dueDate: row.due_date,
    amount: Number(row.amount),
    chargeAmount: Number(row.charge_amount),
    taxAmount: Number(row.tax_amount),
    status: row.payment_status,
    paidAt: row.paid_at,
    skippedAt: row.skipped_at,
  };
}

function customerEnrollmentRecord(row: RowDataPacket, installments: Record<string, unknown>[]): Record<string, unknown> {
  return {
    id: row.enrollment_id,
    schemeId: row.scheme_id,
    schemeName: row.scheme_name,
    metal: row.metal,
    purity: row.purity,
    frequency: row.frequency,
    durationMonths: Number(row.duration_months),
    installmentAmount: Number(row.installment_amount),
    installmentCount: Number(row.installment_count),
    totalCustomerPayments: Number(row.total_customer_payments),
    chargeType: row.charge_type,
    chargeValue: Number(row.charge_value),
    totalCharges: Number(row.total_charges),
    taxRateBps: Number(row.tax_rate_bps),
    totalTaxes: Number(row.total_taxes),
    totalInvestment: Number(row.total_investment),
    status: row.status,
    startDate: row.start_date,
    maturityDate: row.maturity_date,
    nextDueDate: row.next_due_date,
    createdAt: row.created_at,
    source: "scheme",
    installments,
  };
}

function customerPlanEnrollmentRecord(row: RowDataPacket, installments: Record<string, unknown>[]): Record<string, unknown> {
  return {
    id: row.sip_id,
    schemeId: row.sip_id,
    schemeName: `${row.metal} SIP`,
    metal: row.metal,
    purity: row.purity,
    durationMonths: Number(row.duration_months) + Number(row.shop_owner_contribution_months),
    installmentAmount: Number(row.monthly_amount),
    installmentCount: installments.length,
    totalCustomerPayments: Number(row.total_customer_payments),
    chargeType: "fixed",
    chargeValue: 0,
    totalCharges: 0,
    taxRateBps: 0,
    totalTaxes: 0,
    totalInvestment: Number(row.total_investment),
    totalShopOwnerContribution: Number(row.total_shop_owner_contribution),
    status: row.status,
    startDate: row.start_date,
    maturityDate: row.maturity_date,
    nextDueDate: row.next_due_date,
    createdAt: row.created_at,
    source: "admin-plan",
    installments,
  };
}

async function loadCustomerEnrollments(connection: Pool | PoolConnection, customerId: string | number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT e.enrollment_id, e.scheme_id, e.scheme_name, p.metal, p.purity,
            e.frequency, e.duration_months, e.installment_amount, e.installment_count,
            e.total_customer_payments, e.charge_type, e.charge_value, e.total_charges,
            e.tax_rate_bps, e.total_taxes, e.total_investment, e.status,
            DATE_FORMAT(e.start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(e.maturity_date, '%Y-%m-%d') AS maturity_date,
            DATE_FORMAT(e.next_due_date, '%Y-%m-%d') AS next_due_date, e.created_at
     FROM customer_sip_enrollments e
     INNER JOIN admin_metal_products p ON p.product_id = e.product_id
     WHERE e.customer_user_id = ?
     ORDER BY e.created_at DESC, e.enrollment_id DESC`,
    [customerId],
  );
  const enrollmentIds = rows.map((row) => String(row.enrollment_id));
  const installmentsByEnrollment = new Map<string, Record<string, unknown>[]>();
  if (enrollmentIds.length) {
    const placeholders = enrollmentIds.map(() => "?").join(", ");
    const [installments] = await connection.execute<RowDataPacket[]>(
      `SELECT enrollment_id, installment_number,
              DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date, amount,
              charge_amount, tax_amount, payment_status, paid_at, skipped_at
       FROM customer_sip_enrollment_installments
       WHERE enrollment_id IN (${placeholders})
       ORDER BY enrollment_id, installment_number`,
      enrollmentIds,
    );
    for (const installment of installments) {
      const enrollmentId = String(installment.enrollment_id);
      const list = installmentsByEnrollment.get(enrollmentId) ?? [];
      list.push(customerInstallmentRecord(installment));
      installmentsByEnrollment.set(enrollmentId, list);
    }
  }
  return rows.map((row) => customerEnrollmentRecord(
    row,
    installmentsByEnrollment.get(String(row.enrollment_id)) ?? [],
  ));
}

async function loadCustomerPlanEnrollments(connection: Pool | PoolConnection, customerId: string | number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT p.sip_id, m.metal, m.purity, p.monthly_amount, p.duration_months,
            p.total_customer_payments, p.total_shop_owner_contribution,
            p.shop_owner_contribution_months,
            p.total_investment, p.status,
            DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date,
            DATE_FORMAT(p.maturity_date, '%Y-%m-%d') AS maturity_date,
            DATE_FORMAT(p.next_due_date, '%Y-%m-%d') AS next_due_date,
            p.created_at, i.installment_id, i.installment_number,
            DATE_FORMAT(i.due_date, '%Y-%m-%d') AS due_date,
            i.amount, i.payment_status, i.paid_at, i.skipped_at
     FROM customer_sip_plans p
     INNER JOIN admin_metal_products m ON m.product_id = p.product_id
     LEFT JOIN customer_sip_installments i ON i.sip_id = p.sip_id
     WHERE p.customer_user_id = ?
     ORDER BY p.created_at DESC, p.sip_id DESC, i.installment_number`,
    [customerId],
  );
  const grouped = new Map<string, { row: RowDataPacket; installments: Record<string, unknown>[] }>();
  for (const row of rows) {
    const sipId = String(row.sip_id);
    const existing = grouped.get(sipId) ?? { row, installments: [] };
    if (row.installment_number !== null) {
      existing.installments.push(customerInstallmentRecord(row));
    }
    grouped.set(sipId, existing);
  }
  return [...grouped.values()].map(({ row, installments }) => customerPlanEnrollmentRecord(row, installments));
}

function activityLimit(value: unknown): number {
  if (value === undefined) return DEFAULT_ACTIVITY_LIMIT;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("Activity limit must be a positive whole number.");
  }
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_ACTIVITY_LIMIT) {
    throw new Error(`Activity limit must be between 1 and ${MAX_ACTIVITY_LIMIT}.`);
  }
  return limit;
}

router.get("/transactions", requireCustomer, async (request: Request, response: Response) => {
  let limit: number;
  try {
    limit = activityLimit(request.query.limit);
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "Activity limit is invalid.",
    });
    return;
  }

  const customerId = (request as AuthenticatedCustomerRequest).customer.id;
  try {
    const [rows] = await database.execute<CustomerActivityRecord[]>(
      `SELECT activity.id, activity.type, activity.metal,
              activity.quantityGrams, activity.amount, activity.createdAt, activity.status
       FROM (
         SELECT o.order_id AS id,
                LOWER(o.order_type) AS type,
                p.metal AS metal,
                o.quantity AS quantityGrams,
                o.amount AS amount,
                o.placed_at AS createdAt,
                o.status AS status
         FROM admin_orders o
         INNER JOIN admin_metal_products p ON p.product_id = o.product_id
         WHERE o.customer_user_id = ?

         UNION ALL

         SELECT r.redemption_id AS id,
                'redeem' AS type,
                p.metal AS metal,
                r.quantity AS quantityGrams,
                r.amount AS amount,
                r.requested_at AS createdAt,
                r.status AS status
         FROM admin_redemptions r
         INNER JOIN admin_metal_products p ON p.product_id = r.product_id
         WHERE r.customer_user_id = ?

         UNION ALL

         SELECT s.sip_id AS id,
                'sip' AS type,
                p.metal AS metal,
                NULL AS quantityGrams,
                s.amount AS amount,
                s.created_at AS createdAt,
                s.status AS status
         FROM admin_sip_plans s
         INNER JOIN admin_metal_products p ON p.product_id = s.product_id
         WHERE s.customer_user_id = ?

         UNION ALL

         SELECT g.gift_id AS id,
                'gift' AS type,
                p.metal AS metal,
                NULL AS quantityGrams,
                g.amount AS amount,
                g.created_at AS createdAt,
                g.status AS status
         FROM admin_gifts g
         INNER JOIN admin_metal_products p ON p.product_id = g.product_id
         WHERE g.sender_user_id = ?
       ) AS activity
       ORDER BY activity.createdAt DESC, activity.id DESC
       LIMIT ?`,
      [customerId, customerId, customerId, customerId, limit],
    );

    response.json({
      transactions: rows.map((row) => ({
        id: row.id,
        type: row.type,
        metal: row.metal,
        quantityGrams: row.quantityGrams === null ? null : Number(row.quantityGrams),
        amount: Number(row.amount),
        createdAt: row.createdAt,
        status: row.status,
      })),
    });
  } catch (error) {
    console.error("Customer activity lookup failed:", error);
    response.status(500).json({ message: "Could not load recent customer activity." });
  }
});

router.get("/sip-schemes", requireCustomer, async (_request: Request, response: Response) => {
  try {
    const [[rows], [adminPlans]] = await Promise.all([
      database.execute<RowDataPacket[]>(
      `SELECT s.scheme_id, s.scheme_name, s.product_id, p.metal, p.purity,
              s.minimum_amount, s.frequency, s.duration_months, s.charge_type,
              s.charge_value, s.tax_rate_bps, s.status
       FROM sip_schemes s
       INNER JOIN admin_metal_products p ON p.product_id = s.product_id
       WHERE UPPER(TRIM(s.status)) = 'ACTIVE'
         AND UPPER(TRIM(p.status)) = 'ACTIVE'
       ORDER BY s.created_at DESC, s.scheme_id DESC`,
      ),
      database.execute<RowDataPacket[]>(
        `SELECT p.sip_id, p.product_id, m.metal, m.purity, p.monthly_amount,
                p.duration_months, p.shop_owner_monthly_contribution,
                p.shop_owner_contribution_months, p.total_shop_owner_contribution,
                p.total_customer_payments, p.total_investment, p.status
         FROM customer_sip_plans p
         INNER JOIN admin_metal_products m ON m.product_id = p.product_id
         WHERE p.customer_user_id IS NULL
           AND UPPER(TRIM(p.status)) = 'ACTIVE'
           AND UPPER(TRIM(m.status)) = 'ACTIVE'
         ORDER BY p.created_at DESC, p.sip_id DESC`,
      ),
    ]);
    response.json({
      schemes: [
        ...rows.map(customerSchemeRecord),
        ...adminPlans.map(customerAdminPlanRecord),
      ],
    });
  } catch (error) {
    console.error("Customer SIP scheme lookup failed:", error);
    response.status(500).json({ message: "Could not load active SIP schemes." });
  }
});

router.get("/sips", requireCustomer, async (request: Request, response: Response) => {
  const customerId = (request as AuthenticatedCustomerRequest).customer.id;
  try {
    const [schemeEnrollments, adminPlanEnrollments] = await Promise.all([
      loadCustomerEnrollments(database, customerId),
      loadCustomerPlanEnrollments(database, customerId),
    ]);
    const enrollments = [...adminPlanEnrollments, ...schemeEnrollments];
    response.setHeader("Cache-Control", "no-store");
    response.json({
      sips: enrollments,
      enrollments,
      history: enrollments.flatMap((enrollment) => {
        const installments = enrollment.installments as Record<string, unknown>[];
        return installments.map((installment) => ({
          enrollmentId: enrollment.id,
          schemeName: enrollment.schemeName,
          metal: enrollment.metal,
          ...installment,
        }));
      }),
    });
  } catch (error) {
    console.error("Customer SIP enrollment lookup failed:", error);
    response.status(500).json({ message: "Could not load SIP enrollment history." });
  }
});

router.post("/sips", requireCustomer, requireApprovedKyc, async (request: Request, response: Response) => {
  const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body as Record<string, unknown>
    : {};
  const source = body.source ?? "scheme";
  if (typeof body.schemeId !== "string" || !body.schemeId.trim()) {
    response.status(400).json({ message: "Choose an active SIP scheme." });
    return;
  }
  if (body.termsAccepted !== true) {
    response.status(400).json({ message: "Accept the SIP terms before enrolling." });
    return;
  }
  if ((source !== "scheme" && source !== "admin-plan")
    || Object.keys(body).some((key) => !["schemeId", "termsAccepted", "source", "monthlyAmount", "durationMonths"].includes(key))) {
    response.status(400).json({ message: "Provide only the SIP scheme, monthly amount, duration, source, and terms acceptance." });
    return;
  }

  const customerId = (request as AuthenticatedCustomerRequest).customer.id;
  if (source === "admin-plan") {
    if ("monthlyAmount" in body || "durationMonths" in body) {
      response.status(400).json({ message: "Admin-created SIP plan amounts and duration cannot be changed during enrollment." });
      return;
    }
    let planConnection: PoolConnection | undefined;
    try {
      planConnection = await database.getConnection();
      await planConnection.beginTransaction();
      const [plans] = await planConnection.execute<RowDataPacket[]>(
        `SELECT p.sip_id
         FROM customer_sip_plans p
         INNER JOIN admin_metal_products m ON m.product_id = p.product_id
         WHERE p.sip_id = ?
           AND p.customer_user_id IS NULL
           AND UPPER(TRIM(p.status)) = 'ACTIVE'
           AND UPPER(TRIM(m.status)) = 'ACTIVE'
         FOR UPDATE`,
        [body.schemeId.trim()],
      );
      if (!plans[0]) {
        await planConnection.rollback();
        response.status(404).json({ message: "The selected SIP plan is no longer available." });
        return;
      }
      const [result] = await planConnection.execute<ResultSetHeader>(
        `UPDATE customer_sip_plans
         SET customer_user_id = ?, customer_terms_accepted_at = UTC_TIMESTAMP()
         WHERE sip_id = ? AND customer_user_id IS NULL
           AND UPPER(TRIM(status)) = 'ACTIVE'`,
        [customerId, body.schemeId.trim()],
      );
      if (result.affectedRows !== 1) {
        await planConnection.rollback();
        response.status(409).json({ message: "The selected SIP plan has already been assigned." });
        return;
      }
      const enrollments = await loadCustomerPlanEnrollments(planConnection, customerId);
      const enrollment = enrollments.find((item) => item.id === body.schemeId);
      if (!enrollment) throw new Error("Assigned SIP plan could not be loaded.");
      await planConnection.commit();
      response.status(201).json({ sip: enrollment, enrollment });
    } catch (error) {
      if (planConnection) {
        await planConnection.rollback().catch((rollbackError: unknown) => {
          console.error("Customer SIP plan assignment rollback failed:", rollbackError);
        });
      }
      const hasDatabaseCode = error && typeof error === "object" && "code" in error;
      if (hasDatabaseCode) console.error("Customer SIP plan assignment failed:", error);
      response.status(hasDatabaseCode ? 500 : 400).json({
        message: hasDatabaseCode
          ? "Could not save your SIP enrollment. Please try again."
          : error instanceof Error ? error.message : "Could not start this SIP.",
      });
    } finally {
      planConnection?.release();
    }
    return;
  }

  let connection: PoolConnection | undefined;
  try {
    connection = await database.getConnection();
    await connection.beginTransaction();
    const [schemes] = await connection.execute<RowDataPacket[]>(
      `SELECT s.scheme_id, s.scheme_name, s.product_id, s.minimum_amount, s.frequency,
              s.duration_months, s.charge_type, s.charge_value, s.tax_rate_bps
       FROM sip_schemes s
       INNER JOIN admin_metal_products p ON p.product_id = s.product_id
       WHERE s.scheme_id = ?
         AND UPPER(TRIM(s.status)) = 'ACTIVE'
         AND UPPER(TRIM(p.status)) = 'ACTIVE'
       FOR UPDATE`,
      [body.schemeId.trim()],
    );
    const scheme = schemes[0];
    if (!scheme) {
      await connection.rollback();
      response.status(404).json({ message: "The selected SIP scheme is not available." });
      return;
    }

    const frequency = String(scheme.frequency) as SipFrequency;
    const minimumAmountPaise = moneyToPaise(String(scheme.minimum_amount), "Minimum investment");
    const principalPaise = moneyToPaise(body.monthlyAmount ?? String(scheme.minimum_amount), "Monthly investment");
    if (principalPaise < minimumAmountPaise) {
      throw new Error(`Monthly investment must be at least ${formatPaise(minimumAmountPaise)}.`);
    }
    const durationInput = body.durationMonths ?? scheme.duration_months;
    const durationMonths = typeof durationInput === "number"
      ? durationInput
      : typeof durationInput === "string" && /^\d+$/.test(durationInput)
        ? Number(durationInput)
        : Number.NaN;
    if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 60) {
      throw new Error("SIP duration must be between 1 and 60 months.");
    }
    const chargeValuePaise = moneyToPaise(String(scheme.charge_value), "SIP charge");
    const chargePaise = scheme.charge_type === "fixed"
      ? chargeValuePaise
      : divideRounded(principalPaise * chargeValuePaise, 10_000n);
    const taxRateBps = BigInt(Number(scheme.tax_rate_bps));
    const taxPaise = divideRounded(chargePaise * taxRateBps, 10_000n);
    const startDate = new Date().toISOString().slice(0, 10);
    const maturityDate = addSipMonths(startDate, durationMonths);
    const dueDates = buildSipSchedule(startDate, frequency, durationMonths);
    if (dueDates.length > 300) throw new Error("SIP schedule exceeds the supported installment limit.");
    const totalPrincipalPaise = principalPaise * BigInt(dueDates.length);
    const totalChargesPaise = chargePaise * BigInt(dueDates.length);
    const totalTaxesPaise = taxPaise * BigInt(dueDates.length);
    const totalInvestmentPaise = totalPrincipalPaise + totalChargesPaise + totalTaxesPaise;
    const enrollmentId = `SIP-ENR-${randomUUID().toUpperCase()}`;
    await connection.execute(
      `INSERT INTO customer_sip_enrollments
         (enrollment_id, customer_user_id, scheme_id, product_id, scheme_name, frequency,
          duration_months, installment_amount, installment_count, total_customer_payments,
          charge_type, charge_value, charge_per_installment, total_charges, tax_rate_bps,
          tax_per_installment, total_taxes, total_investment, status, start_date,
          maturity_date, next_due_date, terms_accepted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, UTC_TIMESTAMP())`,
      [
        enrollmentId, customerId, scheme.scheme_id, scheme.product_id, scheme.scheme_name,
        frequency, durationMonths, formatPaise(principalPaise), dueDates.length,
        formatPaise(totalPrincipalPaise), scheme.charge_type, String(scheme.charge_value),
        formatPaise(chargePaise), formatPaise(totalChargesPaise), Number(scheme.tax_rate_bps),
        formatPaise(taxPaise), formatPaise(totalTaxesPaise), formatPaise(totalInvestmentPaise),
        startDate, maturityDate, dueDates[0] ?? null,
      ],
    );
    for (const [index, dueDate] of dueDates.entries()) {
      await connection.execute(
        `INSERT INTO customer_sip_enrollment_installments
           (enrollment_id, installment_number, due_date, amount, charge_amount, tax_amount, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          enrollmentId, index + 1, dueDate, formatPaise(principalPaise),
          formatPaise(chargePaise), formatPaise(taxPaise),
        ],
      );
    }
    const enrollments = await loadCustomerEnrollments(connection, customerId);
    const enrollment = enrollments.find((item) => item.id === enrollmentId);
    if (!enrollment) throw new Error("SIP enrollment was saved but could not be loaded.");
    await connection.commit();
    response.status(201).json({ sip: enrollment, enrollment });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError: unknown) => {
        console.error("Customer SIP enrollment rollback failed:", rollbackError);
      });
    }
    const hasDatabaseCode = error && typeof error === "object" && "code" in error;
    if (hasDatabaseCode) console.error("Customer SIP enrollment failed:", error);
    response.status(hasDatabaseCode ? 500 : 400).json({
      message: hasDatabaseCode
        ? "Could not save your SIP enrollment. Please try again."
        : error instanceof Error ? error.message : "Could not start this SIP.",
    });
  } finally {
    connection?.release();
  }
});

export default router;
