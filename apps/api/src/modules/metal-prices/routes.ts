import { Router, type NextFunction, type Request, type Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import database from "../../config/database";
import { requireAdmin, type AuthenticatedRequest } from "../auth/middleware";
import { getCurrentMetalPrices } from "./data";
import { saveMetalPriceSchema } from "./validation";

const router = Router();
router.use(requireAdmin);

interface SavedMetalPriceRow extends RowDataPacket {
  rate_id: string | number;
  metal_type: "Gold" | "Silver" | "Platinum";
  rate_per_gram: string | number;
  purity: string;
  effective_date: string;
  updated_at: string;
}

function requireSuperAdmin(request: Request, response: Response, next: NextFunction): void {
  const admin = (request as AuthenticatedRequest).admin;
  if (admin.roleId !== "SUPER_ADMIN") {
    response.status(403).json({ message: "Only Super Admin can update daily metal prices." });
    return;
  }
  next();
}

router.get("/", async (_request, response) => {
  try {
    response.json({ rates: await getCurrentMetalPrices() });
  } catch (error) {
    console.error("Admin metal price lookup failed:", error);
    response.status(500).json({ message: "Could not load current metal prices." });
  }
});

router.post("/", requireSuperAdmin, async (request, response) => {
  const input = saveMetalPriceSchema.safeParse(request.body);
  if (!input.success) {
    response.status(400).json({ message: input.error.issues[0]?.message ?? "Enter valid metal price details." });
    return;
  }

  try {
    const [insertResult] = await database.execute<ResultSetHeader>(
      `INSERT INTO admin_metal_price_history
         (metal_type, rate_per_gram, purity, effective_date)
       VALUES (?, ?, ?, ?)`,
      [input.data.metalType, input.data.ratePerGram, input.data.purity, input.data.effectiveDate],
    );
    const [rows] = await database.execute<SavedMetalPriceRow[]>(
      `SELECT rate_id,
              metal_type,
              rate_per_gram,
              purity,
              DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date,
              DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM admin_metal_price_history
       WHERE rate_id = ?
       LIMIT 1`,
      [insertResult.insertId],
    );
    const saved = rows[0];
    if (!saved) throw new Error("Inserted metal price could not be read back.");
    response.status(201).json({
      rate: {
        id: String(saved.rate_id),
        metalType: saved.metal_type,
        metalId: saved.metal_type.toLowerCase(),
        ratePerGram: Number(saved.rate_per_gram),
        purity: saved.purity,
        effectiveDate: saved.effective_date,
        updatedAt: saved.updated_at,
      },
    });
  } catch (error) {
    console.error("Admin metal price update failed:", error);
    response.status(500).json({ message: "Could not save the metal price." });
  }
});

export default router;
