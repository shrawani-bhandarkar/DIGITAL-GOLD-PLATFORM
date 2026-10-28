-- Existing making charges remain fixed rupee values unless an administrator changes their type.
ALTER TABLE admin_metal_making_charges
  CHANGE COLUMN charge_per_purchase charge_value DECIMAL(12,2) UNSIGNED NOT NULL,
  ADD COLUMN charge_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'fixed' AFTER metal;
