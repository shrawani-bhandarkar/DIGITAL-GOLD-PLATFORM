CREATE TABLE IF NOT EXISTS customer_otp_challenges (
  user_id BIGINT NOT NULL,
  otp_hash BINARY(32) NOT NULL,
  expires_at DATETIME NOT NULL,
  request_window_started_at DATETIME NOT NULL,
  request_count TINYINT UNSIGNED NOT NULL DEFAULT 1,
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_sent_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  KEY ix_customer_otp_challenges_expiry (expires_at),
  CONSTRAINT fk_customer_otp_challenges_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS customer_auth_sessions (
  token_hash BINARY(32) NOT NULL,
  user_id BIGINT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY ix_customer_auth_sessions_user (user_id),
  KEY ix_customer_auth_sessions_expiry (expires_at),
  CONSTRAINT fk_customer_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
