import { randomInt, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import database from "../../config/database";
import { AuthenticatedCustomerRequest, requireCustomer } from "./middleware";
import { createCustomerToken, hashCustomerOtp, hashCustomerToken } from "./tokens";

const router = Router();
export const customerProfileRouter = Router();
const OTP_LIFETIME_MINUTES = 5;
const REQUEST_WINDOW_MINUTES = 15;
const REQUEST_LIMIT = 3;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_VERIFY_ATTEMPTS = 5;

interface CustomerRecord extends RowDataPacket {
  user_id: string | number;
  full_name: string;
  mobile: string;
  email: string | null;
}

interface OtpChallengeRecord extends RowDataPacket {
  otp_hash: Buffer;
  expires_at: Date | string;
  request_window_started_at: Date | string;
  request_count: number;
  failed_attempts: number;
  last_sent_at: Date | string;
  expired: number;
}

function normalizedMobile(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a valid 10-digit Indian mobile number.");
  const mobile = value.replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  }
  return mobile;
}

function requestError(response: Response, error: unknown): void {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "ER_DUP_ENTRY") {
    response.status(409).json({ message: "A customer is already registered with those details." });
    return;
  }
  if (error instanceof Error && error.message.startsWith("Enter a valid")) {
    response.status(400).json({ message: error.message });
    return;
  }
  console.error("Customer OTP request failed:", error);
  response.status(500).json({ message: "Could not request a verification code." });
}

async function findRegisteredCustomer(mobile: string): Promise<CustomerRecord | null> {
  const [rows] = await database.execute<CustomerRecord[]>(
    `SELECT u.user_id, u.full_name, u.mobile, u.email
     FROM users u
     INNER JOIN admin_customer_profiles p ON p.user_id = u.user_id
     WHERE RIGHT(REGEXP_REPLACE(u.mobile, '[^0-9]', ''), 10) = ?
       AND u.status = 'ACTIVE'
     LIMIT 2`,
    [mobile],
  );
  return rows.length === 1 ? rows[0] : null;
}

function newOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function generateOtp(
  connection: PoolConnection,
  userId: string | number,
  otpHash: Buffer,
): Promise<void> {
  const [insertResult] = await connection.execute<ResultSetHeader>(
    `INSERT IGNORE INTO customer_otp_challenges
       (user_id, otp_hash, expires_at, request_window_started_at, request_count, failed_attempts, last_sent_at)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), UTC_TIMESTAMP(), 1, 0, UTC_TIMESTAMP())`,
    [userId, otpHash, OTP_LIFETIME_MINUTES],
  );
  if (insertResult.affectedRows === 1) return;
  const [rows] = await connection.execute<OtpChallengeRecord[]>(
    `SELECT otp_hash, expires_at, request_window_started_at, request_count,
            failed_attempts, last_sent_at,
            (expires_at <= UTC_TIMESTAMP()) AS expired
     FROM customer_otp_challenges
     WHERE user_id = ?
     FOR UPDATE`,
    [userId],
  );
  const challenge = rows[0];
  if (!challenge) throw new Error("Could not create an OTP challenge.");
  const [cooldownRows] = await connection.execute<RowDataPacket[]>(
    `SELECT TIMESTAMPDIFF(SECOND, last_sent_at, UTC_TIMESTAMP()) AS seconds_since_send,
            (request_window_started_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)) AS window_expired
     FROM customer_otp_challenges
     WHERE user_id = ?`,
    [REQUEST_WINDOW_MINUTES, userId],
  );
  const cooldown = cooldownRows[0];
  if (!cooldown) throw new Error("Could not read the OTP request limit.");
  if (!Number(cooldown.window_expired) && Number(challenge.request_count) >= REQUEST_LIMIT) {
    throw new Error("Too many code requests. Try again later.");
  }
  if (Number(cooldown.seconds_since_send) < RESEND_COOLDOWN_SECONDS) {
    throw new Error("Please wait before requesting another code.");
  }

  await connection.execute(
    `UPDATE customer_otp_challenges
     SET otp_hash = ?,
         expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE),
         request_count = IF(
           request_window_started_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE),
           1,
           request_count + 1
         ),
         request_window_started_at = IF(
           request_window_started_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE),
           UTC_TIMESTAMP(),
           request_window_started_at
         ),
         failed_attempts = 0,
         last_sent_at = UTC_TIMESTAMP()
     WHERE user_id = ?`,
    [otpHash, OTP_LIFETIME_MINUTES, REQUEST_WINDOW_MINUTES, REQUEST_WINDOW_MINUTES, userId],
  );
}

router.post("/otp/request", async (request: Request, response: Response) => {
  let mobile: string;
  try {
    mobile = normalizedMobile(request.body?.mobileNumber);
  } catch (error) {
    requestError(response, error);
    return;
  }

  try {
    const customer = await findRegisteredCustomer(mobile);
    if (!customer) {
      response.status(404).json({ message: "Mobile number is not registered" });
      return;
    }
    if (process.env.NODE_ENV !== "development") {
      response.status(503).json({ message: "Customer OTP delivery is not configured for this environment." });
      return;
    }

    const otp = newOtp();
    const connection = await database.getConnection();
    try {
      await connection.beginTransaction();
      await generateOtp(connection, customer.user_id, hashCustomerOtp(otp));
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch((rollbackError: unknown) => {
        console.error("Customer OTP request rollback failed:", rollbackError);
      });
      if (error instanceof Error && error.message.startsWith("Please wait")) {
        response.status(429).json({ message: error.message });
        return;
      }
      if (error instanceof Error && error.message.startsWith("Too many")) {
        response.status(429).json({ message: error.message });
        return;
      }
      throw error;
    } finally {
      connection.release();
    }
    response.status(200).json({
      message: "Verification code generated.",
      developmentOtp: otp,
    });
  } catch (error) {
    requestError(response, error);
  }
});

router.post("/otp/verify", async (request: Request, response: Response) => {
  let mobile: string;
  if (typeof request.body?.otp !== "string" || !/^\d{6}$/.test(request.body.otp)) {
    response.status(400).json({ message: "Enter a valid six-digit verification code." });
    return;
  }
  try {
    mobile = normalizedMobile(request.body?.mobileNumber);
  } catch (error) {
    requestError(response, error);
    return;
  }

  let connection: PoolConnection | undefined;
  try {
    const customer = await findRegisteredCustomer(mobile);
    if (!customer) {
      response.status(401).json({ message: "The verification code is incorrect or expired." });
      return;
    }
    connection = await database.getConnection();
    await connection.beginTransaction();
    const [challenges] = await connection.execute<OtpChallengeRecord[]>(
      `SELECT otp_hash, expires_at, request_window_started_at, request_count,
              failed_attempts, last_sent_at,
              (expires_at <= UTC_TIMESTAMP()) AS expired
       FROM customer_otp_challenges
       WHERE user_id = ?
       FOR UPDATE`,
      [customer.user_id],
    );
    const challenge = challenges[0];
    if (!challenge || Number(challenge.expired) || Number(challenge.failed_attempts) >= MAX_VERIFY_ATTEMPTS) {
      if (challenge) {
        await connection.execute("DELETE FROM customer_otp_challenges WHERE user_id = ?", [customer.user_id]);
      }
      await connection.commit();
      response.status(401).json({ message: "The verification code is incorrect or expired." });
      return;
    }

    const candidateHash = hashCustomerOtp(request.body.otp);
    if (!timingSafeEqual(Buffer.from(challenge.otp_hash), candidateHash)) {
      const nextAttempts = Number(challenge.failed_attempts) + 1;
      if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
        await connection.execute("DELETE FROM customer_otp_challenges WHERE user_id = ?", [customer.user_id]);
      } else {
        await connection.execute(
          "UPDATE customer_otp_challenges SET failed_attempts = ? WHERE user_id = ?",
          [nextAttempts, customer.user_id],
        );
      }
      await connection.commit();
      response.status(401).json({ message: "The verification code is incorrect or expired." });
      return;
    }

    await connection.execute("DELETE FROM customer_otp_challenges WHERE user_id = ?", [customer.user_id]);
    const token = createCustomerToken(customer.user_id, customer.mobile);
    await connection.execute(
      `INSERT INTO customer_auth_sessions (token_hash, user_id, expires_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))`,
      [hashCustomerToken(token), customer.user_id],
    );
    await connection.commit();
    response.json({
      verified: true,
      accessToken: token,
      profile: {
        id: customer.user_id,
        name: customer.full_name,
        mobileNumber: customer.mobile,
        email: customer.email,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch((rollbackError: unknown) => {
        console.error("Customer OTP verification rollback failed:", rollbackError);
      });
    }
    console.error("Customer OTP verification failed:", error);
    response.status(500).json({ message: "Could not verify the customer code." });
  } finally {
    connection?.release();
  }
});

router.post("/logout", requireCustomer, async (request: Request, response: Response) => {
  const customerRequest = request as AuthenticatedCustomerRequest;
  try {
    await database.execute(
      "DELETE FROM customer_auth_sessions WHERE token_hash = ?",
      [hashCustomerToken(customerRequest.customerToken)],
    );
    response.status(204).end();
  } catch (error) {
    console.error("Customer logout failed:", error);
    response.status(500).json({ message: "Could not end the customer session." });
  }
});

customerProfileRouter.get("/", requireCustomer, (request: Request, response: Response) => {
  const customerRequest = request as AuthenticatedCustomerRequest;
  response.json({ profile: customerRequest.customer });
});

export default router;
