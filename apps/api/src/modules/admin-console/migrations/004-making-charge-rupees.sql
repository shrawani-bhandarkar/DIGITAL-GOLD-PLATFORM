-- Run once on databases created with the legacy paise column.
-- Existing values are paise (for example, 40000 means ₹400.00).
ALTER TABLE admin_metal_making_charges
  CHANGE COLUMN charge_per_gram_paise charge_per_purchase DECIMAL(12,2) UNSIGNED NOT NULL;

UPDATE admin_metal_making_charges
SET charge_per_purchase = ROUND(charge_per_purchase / 100, 2);
