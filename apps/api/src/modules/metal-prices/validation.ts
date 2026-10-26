import { z } from "zod";

const METAL_TYPES = ["Gold", "Silver", "Platinum"] as const;

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const saveMetalPriceSchema = z.object({
  metalType: z.enum(METAL_TYPES),
  ratePerGram: z.number()
    .finite()
    .positive()
    .max(999999999999.9999)
    .refine((value) => Number.isInteger(value * 10000), "Rate per gram supports at most four decimal places."),
  purity: z.string().trim().min(1).max(32),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDate, "Enter a valid effective date."),
}).strict();

export type SaveMetalPriceInput = z.infer<typeof saveMetalPriceSchema>;
