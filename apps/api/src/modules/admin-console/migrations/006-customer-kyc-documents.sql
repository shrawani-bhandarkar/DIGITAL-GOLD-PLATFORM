CREATE TABLE IF NOT EXISTS customer_kyc_documents (
  user_id BIGINT NOT NULL,
  document_type ENUM('aadhaar', 'pan') NOT NULL,
  encrypted_document VARBINARY(64) NOT NULL,
  encryption_iv BINARY(12) NOT NULL,
  encryption_tag BINARY(16) NOT NULL,
  status ENUM('PENDING', 'IN_PROGRESS', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  consented_at DATETIME NOT NULL,
  submitted_at DATETIME NOT NULL,
  reviewed_at DATETIME NULL,
  PRIMARY KEY (user_id, document_type),
  CONSTRAINT fk_customer_kyc_documents_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
