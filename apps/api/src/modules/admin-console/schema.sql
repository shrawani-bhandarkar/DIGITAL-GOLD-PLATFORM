CREATE TABLE IF NOT EXISTS admin_customer_profiles (
  user_id BIGINT NOT NULL,
  city VARCHAR(120) NOT NULL DEFAULT '',
  pan VARCHAR(10) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_admin_customer_profiles_pan (pan),
  CONSTRAINT fk_admin_customer_profiles_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS customer_kyc_documents (
  user_id BIGINT NOT NULL,
  document_type ENUM('aadhaar', 'pan') NOT NULL,
  encrypted_document VARBINARY(64) NOT NULL,
  encryption_iv BINARY(12) NOT NULL,
  encryption_tag BINARY(16) NOT NULL,
  status ENUM('PENDING', 'IN_PROGRESS', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  consented_at DATETIME NULL,
  submitted_at DATETIME NOT NULL,
  reviewed_at DATETIME NULL,
  PRIMARY KEY (user_id, document_type),
  CONSTRAINT fk_customer_kyc_documents_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_metal_products (
  product_id VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  metal VARCHAR(32) NOT NULL,
  purity VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL,
  product_data JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  UNIQUE KEY uq_admin_metal_products_name (name),
  KEY ix_admin_metal_products_metal_status (metal, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_metal_price_history (
  rate_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  metal_type ENUM('Gold', 'Silver', 'Platinum') NOT NULL,
  rate_per_gram DECIMAL(20, 4) NOT NULL,
  purity VARCHAR(32) NOT NULL,
  effective_date DATE NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rate_id),
  KEY ix_admin_metal_price_history_latest (metal_type, effective_date, updated_at, rate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_rate_requests (
  request_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL,
  requested_by VARCHAR(120) NOT NULL,
  requested_at DATETIME NOT NULL,
  request_data JSON NOT NULL,
  PRIMARY KEY (request_id),
  KEY ix_admin_rate_requests_status_requested (status, requested_at),
  KEY ix_admin_rate_requests_product (product_id),
  CONSTRAINT fk_admin_rate_requests_product
    FOREIGN KEY (product_id) REFERENCES admin_metal_products (product_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_metal_making_charges (
  metal VARCHAR(32) NOT NULL,
  charge_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'fixed',
  charge_value DECIMAL(12,2) UNSIGNED NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (metal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_metal_gst_settings (
  settings_id TINYINT UNSIGNED NOT NULL,
  seller_state_code CHAR(2) NOT NULL DEFAULT 'MH',
  cgst_bps SMALLINT UNSIGNED NOT NULL,
  sgst_bps SMALLINT UNSIGNED NOT NULL,
  igst_bps SMALLINT UNSIGNED NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by_type VARCHAR(16) NULL,
  updated_by_id INT NULL,
  PRIMARY KEY (settings_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_orders (
  order_id VARCHAR(64) NOT NULL,
  customer_user_id BIGINT NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  order_type VARCHAR(16) NOT NULL,
  status VARCHAR(32) NOT NULL,
  quantity DECIMAL(20, 6) NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  placed_at DATETIME NOT NULL,
  order_data JSON NOT NULL,
  PRIMARY KEY (order_id),
  KEY ix_admin_orders_customer_date (customer_user_id, placed_at),
  KEY ix_admin_orders_status_date (status, placed_at),
  KEY ix_admin_orders_product (product_id),
  CONSTRAINT fk_admin_orders_customer
    FOREIGN KEY (customer_user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_admin_orders_product
    FOREIGN KEY (product_id) REFERENCES admin_metal_products (product_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_sip_plans (
  sip_id VARCHAR(64) NOT NULL,
  customer_user_id BIGINT NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  frequency VARCHAR(24) NOT NULL,
  next_debit DATE NULL,
  sip_data JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sip_id),
  KEY ix_admin_sip_plans_customer_status (customer_user_id, status),
  KEY ix_admin_sip_plans_next_debit (next_debit, status),
  CONSTRAINT fk_admin_sip_plans_customer
    FOREIGN KEY (customer_user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_admin_sip_plans_product
    FOREIGN KEY (product_id) REFERENCES admin_metal_products (product_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS customer_sip_plans (
  sip_id VARCHAR(64) NOT NULL,
  customer_user_id BIGINT NULL,
  product_id VARCHAR(64) NOT NULL,
  status ENUM('Active', 'Paused', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Active',
  shop_owner_monthly_contribution DECIMAL(20, 2) UNSIGNED NOT NULL DEFAULT 0,
  shop_owner_contribution_months SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  total_shop_owner_contribution DECIMAL(22, 2) UNSIGNED NOT NULL DEFAULT 0,
  monthly_amount DECIMAL(20, 2) NOT NULL,
  duration_months SMALLINT UNSIGNED NOT NULL,
  total_customer_payments DECIMAL(22, 2) UNSIGNED NOT NULL DEFAULT 0,
  total_investment DECIMAL(22, 2) NOT NULL,
  start_date DATE NOT NULL,
  maturity_date DATE NOT NULL,
  next_due_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sip_id),
  KEY ix_customer_sip_plans_customer_status (customer_user_id, status),
  KEY ix_customer_sip_plans_next_due (next_due_date, status),
  CONSTRAINT fk_customer_sip_plans_customer
    FOREIGN KEY (customer_user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_customer_sip_plans_product
    FOREIGN KEY (product_id) REFERENCES admin_metal_products (product_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS customer_sip_installments (
  installment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sip_id VARCHAR(64) NOT NULL,
  installment_number SMALLINT UNSIGNED NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  payment_status ENUM('PENDING', 'PAID', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  paid_at DATETIME NULL,
  skipped_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (installment_id),
  UNIQUE KEY uq_customer_sip_installment_number (sip_id, installment_number),
  KEY ix_customer_sip_installments_due_status (sip_id, payment_status, due_date),
  CONSTRAINT fk_customer_sip_installments_plan
    FOREIGN KEY (sip_id) REFERENCES customer_sip_plans (sip_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_redemptions (
  redemption_id VARCHAR(64) NOT NULL,
  customer_user_id BIGINT NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  fulfillment_mode VARCHAR(32) NOT NULL,
  quantity DECIMAL(20, 3) NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  tracking VARCHAR(120) NULL,
  requested_at DATETIME NOT NULL,
  redemption_data JSON NOT NULL,
  PRIMARY KEY (redemption_id),
  KEY ix_admin_redemptions_customer_date (customer_user_id, requested_at),
  KEY ix_admin_redemptions_status_date (status, requested_at),
  KEY ix_admin_redemptions_product (product_id),
  CONSTRAINT fk_admin_redemptions_customer
    FOREIGN KEY (customer_user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_admin_redemptions_product
    FOREIGN KEY (product_id) REFERENCES admin_metal_products (product_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_gifts (
  gift_id VARCHAR(64) NOT NULL,
  sender_user_id BIGINT NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  recipient_email VARCHAR(150) NOT NULL,
  status VARCHAR(24) NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  delivery_date DATE NOT NULL,
  gift_data JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (gift_id),
  KEY ix_admin_gifts_sender_created (sender_user_id, created_at),
  KEY ix_admin_gifts_status_delivery (status, delivery_date),
  KEY ix_admin_gifts_product (product_id),
  CONSTRAINT fk_admin_gifts_sender
    FOREIGN KEY (sender_user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_admin_gifts_product
    FOREIGN KEY (product_id) REFERENCES admin_metal_products (product_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_payments (
  payment_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL,
  method VARCHAR(32) NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  provider_reference VARCHAR(150) NULL,
  payment_data JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_id),
  KEY ix_admin_payments_status_created (status, created_at),
  KEY ix_admin_payments_order (order_id),
  CONSTRAINT fk_admin_payments_order
    FOREIGN KEY (order_id) REFERENCES admin_orders (order_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_refunds (
  refund_id VARCHAR(64) NOT NULL,
  payment_id VARCHAR(64) NULL,
  order_id VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL,
  amount DECIMAL(20, 2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  refund_data JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (refund_id),
  KEY ix_admin_refunds_status_created (status, created_at),
  KEY ix_admin_refunds_payment (payment_id),
  KEY ix_admin_refunds_order (order_id),
  CONSTRAINT fk_admin_refunds_payment
    FOREIGN KEY (payment_id) REFERENCES admin_payments (payment_id) ON DELETE RESTRICT,
  CONSTRAINT fk_admin_refunds_order
    FOREIGN KEY (order_id) REFERENCES admin_orders (order_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_settlements (
  settlement_id VARCHAR(64) NOT NULL,
  provider VARCHAR(120) NOT NULL,
  provider_reference VARCHAR(150) NOT NULL,
  status VARCHAR(24) NOT NULL,
  expected_amount DECIMAL(20, 2) NOT NULL,
  settled_amount DECIMAL(20, 2) NOT NULL,
  settlement_data JSON NOT NULL,
  settlement_date DATE NOT NULL,
  PRIMARY KEY (settlement_id),
  UNIQUE KEY uq_admin_settlements_provider_reference (provider_reference),
  KEY ix_admin_settlements_status_date (status, settlement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_audit_events (
  event_id VARCHAR(64) NOT NULL,
  actor_account_type VARCHAR(16) NOT NULL,
  admin_id INT NULL,
  superadmin_id INT NULL,
  actor_name VARCHAR(120) NOT NULL,
  action VARCHAR(160) NOT NULL,
  category VARCHAR(64) NOT NULL,
  target VARCHAR(160) NOT NULL,
  detail TEXT NOT NULL,
  outcome VARCHAR(32) NOT NULL,
  occurred_at DATETIME NOT NULL,
  PRIMARY KEY (event_id),
  KEY ix_admin_audit_events_occurred (occurred_at),
  KEY ix_admin_audit_events_category_occurred (category, occurred_at),
  KEY ix_admin_audit_events_actor (actor_account_type, admin_id, superadmin_id),
  CONSTRAINT fk_admin_audit_events_admin
    FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE SET NULL,
  CONSTRAINT fk_admin_audit_events_superadmin
    FOREIGN KEY (superadmin_id) REFERENCES superadmins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_platform_settings (
  settings_key VARCHAR(32) NOT NULL,
  settings_data JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by_type VARCHAR(16) NULL,
  updated_by_id INT NULL,
  PRIMARY KEY (settings_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id VARCHAR(32) NOT NULL,
  permission_key VARCHAR(48) NOT NULL,
  allowed BOOLEAN NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_metal_ledger (
  entry_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_user_id BIGINT NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  reference_type VARCHAR(24) NOT NULL,
  reference_id VARCHAR(64) NOT NULL,
  action VARCHAR(24) NOT NULL,
  quantity DECIMAL(20, 6) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entry_id),
  UNIQUE KEY uq_admin_metal_ledger_event (reference_type, reference_id, action),
  KEY ix_admin_metal_ledger_customer_product (customer_user_id, product_id, entry_id),
  CONSTRAINT fk_admin_metal_ledger_customer
    FOREIGN KEY (customer_user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_admin_metal_ledger_product
    FOREIGN KEY (product_id) REFERENCES admin_metal_products (product_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_reports (
  report_id VARCHAR(64) NOT NULL,
  report_type VARCHAR(32) NOT NULL,
  filters JSON NOT NULL,
  record_count INT UNSIGNED NOT NULL,
  generated_by_type VARCHAR(16) NOT NULL,
  generated_by_id INT NOT NULL,
  generated_at DATETIME NOT NULL,
  PRIMARY KEY (report_id),
  KEY ix_admin_reports_type_generated (report_type, generated_at),
  KEY ix_admin_reports_actor_generated (generated_by_type, generated_by_id, generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;