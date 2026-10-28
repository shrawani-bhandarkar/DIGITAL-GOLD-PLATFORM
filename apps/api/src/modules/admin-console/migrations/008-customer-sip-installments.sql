CREATE TABLE IF NOT EXISTS customer_sip_plans (
  sip_id VARCHAR(64) NOT NULL,
  customer_user_id BIGINT NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  status ENUM('Active', 'Paused', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Active',
  monthly_amount DECIMAL(20, 2) NOT NULL,
  duration_months SMALLINT UNSIGNED NOT NULL,
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
