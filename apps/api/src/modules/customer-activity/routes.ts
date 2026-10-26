import { Router, type Request, type Response } from "express";
import type { RowDataPacket } from "mysql2";
import database from "../../config/database";
import { AuthenticatedCustomerRequest, requireCustomer } from "../customer-auth/middleware";

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

export default router;
