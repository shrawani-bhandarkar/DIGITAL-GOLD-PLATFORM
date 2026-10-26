import type { RowDataPacket } from "mysql2";
import database from "../../config/database";

interface MetalPriceRow extends RowDataPacket {
  rate_id: string | number;
  metal_type: "Gold" | "Silver" | "Platinum";
  rate_per_gram: string | number;
  purity: string;
  effective_date: string;
  updated_at: string;
}

export interface MetalPrice {
  id: string;
  metalType: "Gold" | "Silver" | "Platinum";
  metalId: "gold" | "silver" | "platinum";
  ratePerGram: number;
  purity: string;
  effectiveDate: string;
  updatedAt: string;
}

const METAL_IDS: Record<MetalPrice["metalType"], MetalPrice["metalId"]> = {
  Gold: "gold",
  Silver: "silver",
  Platinum: "platinum",
};

export async function getCurrentMetalPrices(): Promise<MetalPrice[]> {
  const [rows] = await database.execute<MetalPriceRow[]>(
    `WITH ranked_prices AS (
       SELECT rate_id,
              metal_type,
              rate_per_gram,
              purity,
              DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date,
              DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
              ROW_NUMBER() OVER (
                PARTITION BY metal_type
                ORDER BY effective_date DESC, updated_at DESC, rate_id DESC
              ) AS rate_rank
       FROM admin_metal_price_history
       WHERE effective_date <= UTC_DATE()
     )
     SELECT rate_id, metal_type, rate_per_gram, purity, effective_date, updated_at
     FROM ranked_prices
     WHERE rate_rank = 1
     ORDER BY FIELD(metal_type, 'Gold', 'Silver', 'Platinum')`,
  );

  return rows.map((row) => ({
    id: String(row.rate_id),
    metalType: row.metal_type,
    metalId: METAL_IDS[row.metal_type],
    ratePerGram: Number(row.rate_per_gram),
    purity: row.purity,
    effectiveDate: row.effective_date,
    updatedAt: row.updated_at,
  }));
}
