ALTER TABLE customer_sip_plans
  ADD COLUMN shop_owner_monthly_contribution DECIMAL(20, 2) UNSIGNED NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN shop_owner_contribution_months SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER shop_owner_monthly_contribution,
  ADD COLUMN total_shop_owner_contribution DECIMAL(22, 2) UNSIGNED NOT NULL DEFAULT 0 AFTER shop_owner_contribution_months,
  ADD COLUMN total_customer_payments DECIMAL(22, 2) UNSIGNED NOT NULL DEFAULT 0 AFTER duration_months;

UPDATE customer_sip_plans
SET total_customer_payments = ROUND(monthly_amount * duration_months, 2),
    total_investment = ROUND(monthly_amount * duration_months, 2);
