import type { NextFunction, Request, Response } from "express";
import type { RowDataPacket } from "mysql2";
import database from "../../config/database";
import { hashCustomerToken, verifyCustomerToken } from "./tokens";

interface CustomerSessionRecord extends RowDataPacket {
  user_id: string | number;
  full_name: string;
  mobile: string;
  email: string | null;
  verification_status: "PENDING" | "IN_PROGRESS" | "VERIFIED" | "REJECTED";
}

export interface AuthenticatedCustomerRequest extends Request {
  customer: {
    id: string | number;
    name: string;
    mobileNumber: string;
    email: string | null;
    kycStatus: "PENDING" | "APPROVED" | "REJECTED";
  };
  customerToken: string;
}

export async function requireCustomer(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = request.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  if (!match) {
    response.status(401).json({ message: "Customer authentication is required." });
    return;
  }

  try {
    const token = match[1];
    const claims = verifyCustomerToken(token);
    if (!claims) {
      response.status(401).json({ message: "Your customer session is invalid or expired." });
      return;
    }
    const [rows] = await database.execute<CustomerSessionRecord[]>(
      `SELECT u.user_id, u.full_name, u.mobile, u.email, u.verification_status
       FROM customer_auth_sessions s
       INNER JOIN users u ON u.user_id = s.user_id
       WHERE s.token_hash = ?
         AND s.expires_at > UTC_TIMESTAMP()
         AND u.status = 'ACTIVE'
       LIMIT 1`,
      [hashCustomerToken(token)],
    );
    const session = rows[0];
    if (!session) {
      response.status(401).json({ message: "Your customer session is invalid or expired." });
      return;
    }
    const authenticatedRequest = request as AuthenticatedCustomerRequest;
    authenticatedRequest.customer = {
      id: session.user_id,
      name: session.full_name,
      mobileNumber: session.mobile,
      email: session.email,
      kycStatus: session.verification_status === "VERIFIED"
        ? "APPROVED"
        : session.verification_status === "REJECTED"
          ? "REJECTED"
          : "PENDING",
    };
    authenticatedRequest.customerToken = token;
    next();
  } catch (error) {
    console.error("Customer authorization failed:", error);
    response.status(500).json({ message: "Could not verify the customer session." });
  }
}

export function requireApprovedKyc(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const customerRequest = request as AuthenticatedCustomerRequest;
  if (customerRequest.customer?.kycStatus !== "APPROVED") {
    response.status(403).json({
      code: "KYC_APPROVAL_REQUIRED",
      message: "Complete KYC approval to start buying gold or investing in SIP.",
    });
    return;
  }
  next();
}
