export interface MetalProductRecord {
  product_id: string;
  name: string;
  metal: string;
  purity: string;
  status: string;
  record_data: unknown;
}

export function mapMetalProduct(row: MetalProductRecord): Record<string, unknown> {
  const product = typeof row.record_data === "string"
    ? JSON.parse(row.record_data) as unknown
    : row.record_data;
  if (!product || typeof product !== "object" || Array.isArray(product)) {
    throw new Error(`Metal product ${row.product_id} must contain a JSON object.`);
  }

  return {
    ...(product as Record<string, unknown>),
    id: row.product_id,
    name: row.name,
    metal: row.metal,
    purity: row.purity,
    status: row.status === "ACTIVE" ? "Active" : row.status === "INACTIVE" ? "Inactive" : row.status,
  };
}
