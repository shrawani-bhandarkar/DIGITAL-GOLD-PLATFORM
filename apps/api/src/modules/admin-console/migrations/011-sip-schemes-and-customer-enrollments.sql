CREATE TABLE IF NOT EXISTS sip_schemes (
  scheme_id VARCHAR(64) NOT NULL,
  scheme_name VARCHAR(120) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  minimum_amount DECIMAL(20, 2) UNSIGNED NOT NULL,
  frequency ENUM('Monthly', 'Weekly') NOT NULL,
  duration_months SMALLINT UNSIGNED NOT NULL,
  charge_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'fixed',
  charge_value DECIMAL(12, 2) UNSIGNED NOT NULL DEFAULT 0,
  tax_rate_bps SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (scheme_id),
  KEY ix_sip_schemes_status_metal (status, product_id),
  CONSTRAINT fk_sip_schemes_product
    FOREIGN KEY (product_id) REFERENCES admin_metal_products (product_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS customer_sip_enrollments (
  enrollment_id VARCHAR(64) NOT NULL,
  customer_user_id BIGINT NOT NULL,
  scheme_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  scheme_name VARCHAR(120) NOT NULL,
  frequency ENUM('Monthly', 'Weekly') NOT NULL,
  duration_months SMALLINT UNSIGNED NOT NULL,
  installment_amount DECIMAL(20, 2) UNSIGNED NOT NULL,
  installment_count SMALLINT UNSIGNED NOT NULL,
  total_customer_payments DECIMAL(22, 2) UNSIGNED NOT NULL,
  charge_type ENUM('fixed', 'percentage') NOT NULL,
  charge_value DECIMAL(12, 2) UNSIGNED NOT NULL,
  charge_per_installment DECIMAL(20, 2) UNSIGNED NOT NULL,
  total_charges DECIMAL(22, 2) UNSIGNED NOT NULL,
  tax_rate_bps SMALLINT UNSIGNED NOT NULL,
  tax_per_installment DECIMAL(20, 2) UNSIGNED NOT NULL,
  total_taxes DECIMAL(22, 2) UNSIGNED NOT NULL,
  total_investment DECIMAL(22, 2) UNSIGNED NOT NULL,
  status ENUM('Active', 'Paused', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Active',
  start_date DATE NOT NULL,
  maturity_date DATE NOT NULL,
  next_due_date DATE NULL,
  terms_accepted_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (enrollment_id),
  KEY ix_customer_sip_enrollments_customer_status (customer_user_id, status),
  KEY ix_customer_sip_enrollments_scheme (scheme_id, created_at),
  KEY ix_customer_sip_enrollments_due_status (next_due_date, status),
  CONSTRAINT fk_customer_sip_enrollments_customer
    FOREIGN KEY (customer_user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_customer_sip_enrollments_scheme
    FOREIGN KEY (scheme_id) REFERENCES sip_schemes (scheme_id) ON DELETE RESTRICT,
  CONSTRAINT fk_customer_sip_enrollments_product
    FOREIGN KEY (product_id) REFERENCES admin_metal_products (product_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS customer_sip_enrollment_installments (
  installment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  enrollment_id VARCHAR(64) NOT NULL,
  installment_number SMALLINT UNSIGNED NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(20, 2) UNSIGNED NOT NULL,
  charge_amount DECIMAL(20, 2) UNSIGNED NOT NULL,
  tax_amount DECIMAL(20, 2) UNSIGNED NOT NULL,
  payment_status ENUM('PENDING', 'PAID', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  paid_at DATETIME NULL,
  skipped_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (installment_id),
  UNIQUE KEY uq_customer_sip_enrollment_installment (enrollment_id, installment_number),
  KEY ix_customer_sip_enrollment_installments_status (enrollment_id, payment_status, due_date),
  CONSTRAINT fk_customer_sip_enrollment_installments_enrollment
    FOREIGN KEY (enrollment_id) REFERENCES customer_sip_enrollments (enrollment_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
