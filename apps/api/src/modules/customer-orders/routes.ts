import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { z } from "zod";
import database from "../../config/database";
import { AuthenticatedCustomerRequest, requireApprovedKyc, requireCustomer } from "../customer-auth/middleware";

const router = Router();
const MAX_AMOUNT_PAISE = 1_000_000_000;
const MAX_QUANTITY_MILLI_GRAMS = 10_000_000;
const MAX_QUANTITY_MICRO_GRAMS = 10_000_000_000;
const RATE_QUANTITY_DIVISOR = 100_000_000n;
const QUANTITY_SCALE = 1_000_000n;
const DEFAULT_CUSTOMER_STATE_CODE = "MH";
const INDIAN_STATE_CODES = [
  "AN", "AP", "AR", "AS", "BR", "CH", "CT", "DN", "DD", "DL", "GA", "GJ", "HR", "HP",
  "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML", "MZ", "NL", "OR", "PY",
  "PB", "RJ", "SK", "TN", "TG", "TR", "UP", "UT", "WB",
] as const;

function rupeesToPaise(value: unknown): bigint {
  const text = String(value ?? "0").trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error("Configured making charge must be a valid value with up to two decimal places.");
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

function percentageToBasisPoints(value: unknown): bigint {
  const basisPoints = rupeesToPaise(value);
  if (basisPoints > 10_000n) throw new Error("Configured percentage making charge cannot exceed 100%.");
  return basisPoints;
}

const purchaseInputSchema = z.object({
  metalId: z.enum(["gold", "silver", "platinum"]),
  mode: z.enum(["amount", "grams"]),
  value: z.string().trim().min(1).max(32),
  stateCode: z.enum(INDIAN_STATE_CODES).default(DEFAULT_CUSTOMER_STATE_CODE),
}).strict();
const purchaseSubmissionSchema = purchaseInputSchema.extend({
  quoteToken: z.string().min(1).max(2048),
}).strict();

type PurchaseInput = z.infer<typeof purchaseInputSchema>;
type MetalType = "Gold" | "Silver" | "Platinum";
type IndianStateCode = (typeof INDIAN_STATE_CODES)[number];

interface ProductRow extends RowDataPacket {
  product_id: string;
  name: string;
  metal: string;
  purity: string;
  status: string;
  product_data: unknown;
  updated_at: string;
}

interface RateRow extends RowDataPacket {
  rate_id: string | number;
  metal_type: MetalType;
  rate_per_gram: string | number;
  purity: string;
  effective_date: string;
  updated_at: string;
}

interface MakingChargeRow extends RowDataPacket {
  charge_type: "fixed" | "percentage";
  charge_value: string | number;
  enabled: number | boolean;
  updated_at: string;
}

interface TaxSettingsRow extends RowDataPacket {
  seller_state_code: string | null;
  cgst_bps: string | number;
  sgst_bps: string | number;
  igst_bps: string | number;
  updated_at: string;
}

interface ExistingOrderRow extends RowDataPacket {
  order_id: string;
  status: string;
  record_data: unknown;
}

interface ExistingPaymentRow extends RowDataPacket {
  payment_id: string;
  status: string;
  record_data: unknown;
}

interface CustomerRow extends RowDataPacket {
  user_id: string | number;
  verification_status: string;
}

interface PurchaseQuote {
  metalId: PurchaseInput["metalId"];
  metal: MetalType;
  purity: string;
  ratePerGram: number;
  effectiveDate: string;
  rateUpdatedAt: string;
  mode: PurchaseInput["mode"];
  inputValue: string;
  quantityGrams: number;
  metalValue: number;
  makingChargePerPurchase: number;
  makingChargeValue: number;
  makingChargeType: "fixed" | "percentage";
  makingChargeEnabled: boolean;
  makingChargeConfigured: boolean;
  makingCharges: number;
  purchaseSubtotal: number;
  charges: number;
  chargesConfigured: boolean;
  taxes: number;
  taxesConfigured: boolean;
  taxJurisdiction: "intra-state" | "inter-state";
  customerStateCode: IndianStateCode;
  sellerStateCode: IndianStateCode;
  taxBreakdown: {
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
    ratesBps: { cgst: number; sgst: number; igst: number };
  };
  totalAmount: number;
  currency: "INR";
}

interface ParsedInput {
  input: PurchaseInput;
  valueInSmallestUnit: number;
  fingerprint: string;
  quoteToken?: string;
}

class PurchaseRequestError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409 | 503) {
    super(message);
    this.name = "PurchaseRequestError";
  }
}

function metalType(metalId: PurchaseInput["metalId"]): MetalType {
  return metalId === "gold" ? "Gold" : metalId === "silver" ? "Silver" : "Platinum";
}

function parseInput(value: unknown, forSubmission = false): ParsedInput {
  const parsed = (forSubmission ? purchaseSubmissionSchema : purchaseInputSchema).safeParse(value);
  if (!parsed.success) {
    throw new PurchaseRequestError(parsed.error.issues[0]?.message ?? "Enter valid purchase details.", 400);
  }

  const input = {
    metalId: parsed.data.metalId,
    mode: parsed.data.mode,
    value: parsed.data.value,
    stateCode: parsed.data.stateCode,
  };
  const decimalPattern = input.mode === "amount"
    ? /^(?:\d+)(?:\.\d{1,2})?$/
    : /^(?:\d+)(?:\.\d{1,3})?$/;
  if (!decimalPattern.test(input.value)) {
    throw new PurchaseRequestError(
      input.mode === "amount"
        ? "Enter an amount with up to two decimal places."
        : "Enter a quantity with up to three decimal places.",
      400,
    );
  }

  const [whole, fraction = ""] = input.value.split(".");
  const valueInSmallestUnit = input.mode === "amount"
    ? Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
    : Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  const maximum = input.mode === "amount" ? MAX_AMOUNT_PAISE : MAX_QUANTITY_MILLI_GRAMS;
  if (!Number.isSafeInteger(valueInSmallestUnit) || valueInSmallestUnit <= 0 || valueInSmallestUnit > maximum) {
    throw new PurchaseRequestError(
      input.mode === "amount" ? "Amount must be between ₹0.01 and ₹10,000,000." : "Quantity must be between 0.001 and 10,000 grams.",
      400,
    );
  }

  const fingerprint = JSON.stringify({
    metalId: input.metalId,
    mode: input.mode,
    valueInSmallestUnit,
    stateCode: input.stateCode,
  });
  return {
    input,
    valueInSmallestUnit,
    fingerprint,
    quoteToken: "quoteToken" in parsed.data && typeof parsed.data.quoteToken === "string"
      ? parsed.data.quoteToken
      : undefined,
  };
}

function parseJsonObject(value: unknown, label: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must contain a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function numericBasisPoints(product: Record<string, unknown>, key: string): number {
  const value = product[key] ?? 0;
  const basisPoints = Number(value);
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
    throw new Error(`Configured ${key} must be a non-negative whole number.`);
  }
  return basisPoints;
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function parseRateUnits(value: string | number): bigint {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) throw new Error("The current metal rate is invalid.");
  const [whole, fraction = ""] = text.split(".");
  const units = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0"));
  if (units <= 0n) throw new Error("The current metal rate must be positive.");
  return units;
}

function toSafePaise(value: bigint, label: string): number {
  if (value < 0n || value > BigInt(MAX_AMOUNT_PAISE)) {
    throw new PurchaseRequestError(`${label} exceeds the supported purchase limit.`, 400);
  }
  return Number(value);
}

function rupees(paise: number): number {
  return paise / 100;
}

function paiseString(paise: number): string {
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

function quantityString(microGrams: number): string {
  return `${Math.floor(microGrams / 1_000_000)}.${String(microGrams % 1_000_000).padStart(6, "0")}`;
}

function configuredTaxSettings(value: unknown): {
  sellerStateCode: IndianStateCode;
  cgstBps: number;
  sgstBps: number;
  igstBps: number;
} {
  const settings = value as TaxSettingsRow;
  const sellerStateCode = settings.seller_state_code;
  const cgstBps = Number(settings.cgst_bps);
  const sgstBps = Number(settings.sgst_bps);
  const igstBps = Number(settings.igst_bps);
  if (
    typeof sellerStateCode !== "string"
    || !INDIAN_STATE_CODES.includes(sellerStateCode as IndianStateCode)
    || ![cgstBps, sgstBps, igstBps].every((rate) => Number.isSafeInteger(rate) && rate >= 0 && rate <= 10_000)
    || cgstBps !== sgstBps
    || cgstBps + sgstBps !== igstBps
  ) {
    throw new PurchaseRequestError("Metal GST settings are incomplete or invalid. Ask an administrator to configure GST.", 503);
  }
  return { sellerStateCode: sellerStateCode as IndianStateCode, cgstBps, sgstBps, igstBps };
}

function quoteFor(
  parsed: ParsedInput,
  rate: RateRow,
  makingChargeValue: bigint,
  makingChargeType: "fixed" | "percentage",
  makingChargeEnabled: boolean,
  makingChargeConfigured: boolean,
  product: Record<string, unknown>,
  taxSettings: ReturnType<typeof configuredTaxSettings>,
): PurchaseQuote {
  const rateUnits = parseRateUnits(rate.rate_per_gram);
  const preserveEnteredAmount = parsed.input.mode === "amount" && parsed.input.metalId !== "gold";
  let quantityMicroGrams: bigint;
  if (parsed.input.mode === "amount") {
    quantityMicroGrams = BigInt(parsed.valueInSmallestUnit) * RATE_QUANTITY_DIVISOR / rateUnits;
    if (!preserveEnteredAmount) quantityMicroGrams = quantityMicroGrams / 1000n * 1000n;
  } else {
    quantityMicroGrams = BigInt(parsed.valueInSmallestUnit) * 1000n;
  }
  if (quantityMicroGrams <= 0n || quantityMicroGrams > BigInt(MAX_QUANTITY_MICRO_GRAMS)) {
    throw new PurchaseRequestError("The amount is too small or large to represent a supported metal quantity.", 400);
  }

  let metalValuePaise = preserveEnteredAmount
    ? parsed.valueInSmallestUnit
    : toSafePaise(
      roundDivide(rateUnits * quantityMicroGrams, RATE_QUANTITY_DIVISOR),
      "Metal value",
    );
  if (parsed.input.mode === "amount" && !preserveEnteredAmount) {
    while (metalValuePaise > parsed.valueInSmallestUnit && quantityMicroGrams >= 1000n) {
      quantityMicroGrams -= 1000n;
      metalValuePaise = toSafePaise(
        roundDivide(rateUnits * quantityMicroGrams, RATE_QUANTITY_DIVISOR),
        "Metal value",
      );
    }
  }

  const appliedMakingChargePaise = makingChargeConfigured
    ? toSafePaise(
      makingChargeType === "percentage"
        ? roundDivide(BigInt(metalValuePaise) * makingChargeValue, 10_000n)
        : makingChargeValue,
      "Making charge",
    )
    : 0;
  const chargesPaise = toSafePaise(
    roundDivide(BigInt(metalValuePaise) * BigInt(numericBasisPoints(product, "buyChargeBps")), 10_000n),
    "Purchase charges",
  );
  const subtotalPaise = toSafePaise(BigInt(metalValuePaise + appliedMakingChargePaise), "Purchase subtotal");
  const taxableAmountPaise = toSafePaise(BigInt(subtotalPaise + chargesPaise), "GST taxable amount");
  const isIntraState = parsed.input.stateCode === taxSettings.sellerStateCode;
  const cgstPaise = isIntraState
    ? toSafePaise(roundDivide(BigInt(taxableAmountPaise) * BigInt(taxSettings.cgstBps), 10_000n), "CGST")
    : 0;
  const sgstPaise = isIntraState
    ? toSafePaise(roundDivide(BigInt(taxableAmountPaise) * BigInt(taxSettings.sgstBps), 10_000n), "SGST")
    : 0;
  const igstPaise = isIntraState
    ? 0
    : toSafePaise(roundDivide(BigInt(taxableAmountPaise) * BigInt(taxSettings.igstBps), 10_000n), "IGST");
  const taxesPaise = toSafePaise(BigInt(cgstPaise + sgstPaise + igstPaise), "Purchase GST");
  const totalPaise = toSafePaise(BigInt(taxableAmountPaise + taxesPaise), "Purchase total");
  if (totalPaise <= 0) throw new PurchaseRequestError("The purchase total must be positive.", 400);

  return {
    metalId: parsed.input.metalId,
    metal: rate.metal_type,
    purity: rate.purity,
    ratePerGram: Number(rate.rate_per_gram),
    effectiveDate: rate.effective_date,
    rateUpdatedAt: rate.updated_at,
    mode: parsed.input.mode,
    inputValue: parsed.input.value,
    quantityGrams: Number(quantityMicroGrams) / Number(QUANTITY_SCALE),
    metalValue: rupees(metalValuePaise),
    makingChargePerPurchase: Number(makingChargeValue) / 100,
    makingChargeValue: Number(makingChargeValue) / 100,
    makingChargeType,
    makingChargeEnabled,
    makingChargeConfigured,
    makingCharges: rupees(appliedMakingChargePaise),
    purchaseSubtotal: rupees(subtotalPaise),
    charges: rupees(chargesPaise),
    chargesConfigured: product.buyChargeBps !== undefined && product.buyChargeBps !== null,
    taxes: rupees(taxesPaise),
    taxesConfigured: true,
    taxJurisdiction: isIntraState ? "intra-state" : "inter-state",
    customerStateCode: parsed.input.stateCode,
    sellerStateCode: taxSettings.sellerStateCode,
    taxBreakdown: {
      taxableAmount: rupees(taxableAmountPaise),
      cgst: rupees(cgstPaise),
      sgst: rupees(sgstPaise),
      igst: rupees(igstPaise),
      total: rupees(taxesPaise),
      ratesBps: {
        cgst: taxSettings.cgstBps,
        sgst: taxSettings.sgstBps,
        igst: taxSettings.igstBps,
      },
    },
    totalAmount: rupees(totalPaise),
    currency: "INR",
  };
}

async function currentQuote(
  connection: PoolConnection,
  parsed: ParsedInput,
  lockForPurchase = false,
): Promise<{
  quote: PurchaseQuote;
  product: ProductRow;
  sourceVersion: string;
}> {
  const metal = metalType(parsed.input.metalId);
  const [products] = await connection.execute<ProductRow[]>(
    `SELECT product_id, name, metal, purity, status, product_data,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM admin_metal_products
     WHERE UPPER(metal) = UPPER(?) AND UPPER(status) = 'ACTIVE'
     ORDER BY created_at ASC, product_id ASC
     LIMIT 1${lockForPurchase ? " FOR UPDATE" : ""}`,
    [metal],
  );
  const productRow = products[0];
  if (!productRow) throw new PurchaseRequestError(`No active ${metal} product is available.`, 404);
  const productData = parseJsonObject(productRow.product_data, `Metal product ${productRow.product_id}`);

  const [rates] = await connection.execute<RateRow[]>(
    `SELECT rate_id, metal_type, rate_per_gram, purity,
            DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM admin_metal_price_history
     WHERE metal_type = ? AND effective_date <= UTC_DATE()
     ORDER BY effective_date DESC, updated_at DESC, rate_id DESC
     LIMIT 1${lockForPurchase ? " FOR UPDATE" : ""}`,
    [metal],
  );
  const rate = rates[0];
  if (!rate) throw new PurchaseRequestError(`No current ${metal} rate is available.`, 404);

  const [charges] = await connection.execute<MakingChargeRow[]>(
    `SELECT charge_type, charge_value, enabled,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM admin_metal_making_charges WHERE metal = ? LIMIT 1${lockForPurchase ? " FOR UPDATE" : ""}`,
    [metal],
  );
  const charge = charges[0];
  const chargeType = charge?.charge_type ?? "fixed";
  if (chargeType !== "fixed" && chargeType !== "percentage") throw new Error(`Configured ${metal} making charge type is invalid.`);
  const rawChargeValue = charge?.charge_value ?? "0";
  const chargeValue = chargeType === "percentage"
    ? percentageToBasisPoints(rawChargeValue)
    : rupeesToPaise(rawChargeValue);
  const enabled = Boolean(charge?.enabled);
  const [taxSettingsRows] = await connection.execute<TaxSettingsRow[]>(
    `SELECT seller_state_code, cgst_bps, sgst_bps, igst_bps,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
     FROM admin_metal_gst_settings WHERE settings_id = 1 LIMIT 1${lockForPurchase ? " FOR UPDATE" : ""}`,
  );
  if (!taxSettingsRows[0]) {
    throw new PurchaseRequestError("Metal GST settings are not configured. Ask an administrator to configure GST before purchasing.", 503);
  }
  const taxSettings = configuredTaxSettings(taxSettingsRows[0]);
  const quote = quoteFor(parsed, rate, chargeValue, chargeType, enabled, Boolean(charge), productData, taxSettings);
  const sourceVersion = [
    rate.rate_id,
    rate.updated_at,
    productRow.updated_at,
    charge?.updated_at ?? "not-configured",
    chargeType,
    chargeValue.toString(),
    enabled ? "enabled" : "disabled",
    taxSettingsRows[0].updated_at,
    JSON.stringify(taxSettings),
  ].join(":");
  return { quote, product: productRow, sourceVersion };
}

function quoteSigningSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes to sign purchase quotes.");
  }
  return secret;
}

function createQuoteToken(fingerprint: string, sourceVersion: string): string {
  const payload = Buffer.from(JSON.stringify({
    fingerprint,
    sourceVersion,
    expiresAt: Date.now() + 2 * 60 * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", quoteSigningSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function assertQuoteToken(
  token: string | undefined,
  fingerprint: string,
  sourceVersion: string,
): void {
  if (!token) throw new PurchaseRequestError("A current server quote is required.", 400);
  const [payload, suppliedSignature, ...extra] = token.split(".");
  if (!payload || !suppliedSignature || extra.length > 0) {
    throw new PurchaseRequestError("The purchase quote token is invalid.", 400);
  }
  const expectedSignature = createHmac("sha256", quoteSigningSecret()).update(payload).digest();
  const actualSignature = Buffer.from(suppliedSignature, "base64url");
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    throw new PurchaseRequestError("The purchase quote token is invalid.", 400);
  }

  let signedQuote: { fingerprint?: unknown; sourceVersion?: unknown; expiresAt?: unknown };
  try {
    signedQuote = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as typeof signedQuote;
  } catch {
    throw new PurchaseRequestError("The purchase quote token is invalid.", 400);
  }
  if (
    signedQuote.fingerprint !== fingerprint
    || typeof signedQuote.expiresAt !== "number"
    || signedQuote.expiresAt <= Date.now()
    || signedQuote.sourceVersion !== sourceVersion
  ) {
    throw new PurchaseRequestError("The purchase quote expired or current rates or charges changed. Request and review a new quote.", 409);
  }
}

function parseRecord(value: unknown): Record<string, unknown> {
  return parseJsonObject(value, "Stored purchase order");
}

function idempotencyKey(request: Request): string {
  const key = request.get("Idempotency-Key") ?? "";
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(key)) {
    throw new PurchaseRequestError("A valid Idempotency-Key header is required.", 400);
  }
  return key;
}

async function orderResponse(
  connection: PoolConnection,
  orderId: string,
  storedOrder: Record<string, unknown>,
  isIdempotent: boolean,
): Promise<Record<string, unknown>> {
  const [payments] = await connection.execute<ExistingPaymentRow[]>(
    "SELECT payment_id, status, payment_data AS record_data FROM admin_payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1",
    [orderId],
  );
  const payment = payments[0]
    ? { ...parseRecord(payments[0].record_data), status: payments[0].status }
    : null;
  return {
    order: { ...storedOrder, id: orderId },
    payment,
    idempotent: isIdempotent,
  };
}

function respondError(response: Response, error: unknown, operation: string): void {
  if (error instanceof PurchaseRequestError) {
    response.status(error.status).json({ message: error.message });
    return;
  }
  console.error(`${operation} failed:`, error);
  response.status(500).json({ message: `Could not ${operation.toLowerCase()}.` });
}

router.post("/purchase/quote", requireCustomer, async (request: Request, response: Response) => {
  let connection: PoolConnection | undefined;
  try {
    response.setHeader("Cache-Control", "no-store");
    const parsed = parseInput(request.body);
    connection = await database.getConnection();
    await connection.beginTransaction();
    const { quote, sourceVersion } = await currentQuote(connection, parsed);
    await connection.commit();
    response.json({ quote: { ...quote, quoteToken: createQuoteToken(parsed.fingerprint, sourceVersion) } });
  } catch (error) {
    if (connection) await connection.rollback().catch((rollbackError: unknown) => {
      console.error("Customer purchase quote rollback failed:", rollbackError);
    });
    respondError(response, error, "load purchase quote");
  } finally {
    connection?.release();
  }
});

router.post("/purchase", requireCustomer, requireApprovedKyc, async (request: Request, response: Response) => {
  let connection: PoolConnection | undefined;
  try {
    const parsed = parseInput(request.body, true);
    const key = idempotencyKey(request);
    const customer = (request as AuthenticatedCustomerRequest).customer;
    connection = await database.getConnection();
    await connection.beginTransaction();

    const [customers] = await connection.execute<CustomerRow[]>(
      "SELECT user_id, verification_status FROM users WHERE user_id = ? AND status = 'ACTIVE' FOR UPDATE",
      [customer.id],
    );
    if (!customers[0]) throw new PurchaseRequestError("The customer account is no longer active.", 401);
    if (customers[0].verification_status !== "VERIFIED") {
      throw new PurchaseRequestError(
        "Complete KYC approval to start buying gold or investing in SIP.",
        403,
      );
    }

    const [existingOrders] = await connection.execute<ExistingOrderRow[]>(
      `SELECT order_id, status, order_data AS record_data
       FROM admin_orders
       WHERE customer_user_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(order_data, '$.idempotencyKey')) = ?
       LIMIT 1
       FOR UPDATE`,
      [customer.id, key],
    );
    const existing = existingOrders[0];
    if (existing) {
      const order = parseRecord(existing.record_data);
      if (order.requestFingerprint !== parsed.fingerprint) {
        throw new PurchaseRequestError("This Idempotency-Key was already used for a different purchase.", 409);
      }
      order.status = existing.status;
      await connection.commit();
      response.json(await orderResponse(connection, existing.order_id, order, true));
      return;
    }

    const { quote, product, sourceVersion } = await currentQuote(connection, parsed, true);
    assertQuoteToken(parsed.quoteToken, parsed.fingerprint, sourceVersion);
    const orderId = `ORD-${randomUUID()}`;
    const paymentId = `PAY-${randomUUID()}`;
    const placedAt = new Date().toISOString();
    const order = {
      id: orderId,
      type: "Buy",
      metal: quote.metal,
      purity: quote.purity,
      status: "Pending",
      customer: customer.name,
      customerId: `CUS-${customer.id}`,
      productId: product.product_id,
      rate: quote.ratePerGram,
      rateEffectiveDate: quote.effectiveDate,
      rateUpdatedAt: quote.rateUpdatedAt,
      quantity: quote.quantityGrams,
      baseAmount: quote.metalValue,
      makingChargePerPurchase: quote.makingChargePerPurchase,
      makingChargeEnabled: quote.makingChargeEnabled,
      makingChargeConfigured: quote.makingChargeConfigured,
      makingCharges: quote.makingCharges,
      purchaseSubtotal: quote.purchaseSubtotal,
      charges: quote.charges,
      taxes: quote.taxes,
      taxJurisdiction: quote.taxJurisdiction,
      customerStateCode: quote.customerStateCode,
      sellerStateCode: quote.sellerStateCode,
      taxBreakdown: quote.taxBreakdown,
      amount: quote.totalAmount,
      payment: "Not configured",
      paymentStatus: "Pending",
      paymentMode: "no-gateway",
      paymentMessage: "Payment gateway is not configured; no payment has been collected.",
      source: "customer-quick-buy",
      input: { metalId: parsed.input.metalId, mode: parsed.input.mode, value: parsed.input.value, stateCode: parsed.input.stateCode },
      requestFingerprint: parsed.fingerprint,
      idempotencyKey: key,
      placedAt,
      timeline: [
        { label: "Quick Buy order placed", time: placedAt, done: true },
        { label: "Payment pending; no gateway configured", time: placedAt, done: false },
      ],
    };
    const amountPaise = Math.round(quote.totalAmount * 100);
    const payment = {
      id: paymentId,
      orderId,
      customer: customer.name,
      method: "Not configured",
      amount: quote.totalAmount,
      currency: "INR",
      providerRef: "",
      status: "Pending",
      paymentMode: "no-gateway",
      message: "No payment was initiated or collected.",
      date: placedAt.slice(0, 10),
      time: placedAt.slice(11, 19),
    };

    await connection.execute(
      `INSERT INTO admin_orders
         (order_id, customer_user_id, product_id, order_type, status, quantity, amount, placed_at, order_data)
       VALUES (?, ?, ?, 'Buy', 'Pending', ?, ?, UTC_TIMESTAMP(), ?)`,
      [
        orderId,
        customer.id,
        product.product_id,
        quantityString(Math.round(quote.quantityGrams * Number(QUANTITY_SCALE))),
        paiseString(amountPaise),
        JSON.stringify(order),
      ],
    );
    await connection.execute(
      `INSERT INTO admin_payments
         (payment_id, order_id, status, method, amount, provider_reference, payment_data)
       VALUES (?, ?, 'Pending', 'Not configured', ?, NULL, ?)`,
      [paymentId, orderId, paiseString(amountPaise), JSON.stringify(payment)],
    );
    await connection.commit();
    response.status(201).json({ order, payment, idempotent: false });
  } catch (error) {
    if (connection) await connection.rollback().catch((rollbackError: unknown) => {
      console.error("Customer purchase rollback failed:", rollbackError);
    });
    respondError(response, error, "create customer purchase");
  } finally {
    connection?.release();
  }
});

export default router;
