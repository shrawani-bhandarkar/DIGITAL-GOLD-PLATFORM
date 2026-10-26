ALTER TABLE admin_orders
  MODIFY COLUMN quantity DECIMAL(20, 6) NOT NULL;

ALTER TABLE admin_metal_ledger
  MODIFY COLUMN quantity DECIMAL(20, 6) NOT NULL;
