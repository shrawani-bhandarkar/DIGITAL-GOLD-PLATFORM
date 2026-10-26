CREATE TABLE IF NOT EXISTS admin_metal_making_charges (
  metal VARCHAR(32) NOT NULL,
  charge_per_purchase DECIMAL(12,2) UNSIGNED NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (metal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_metal_gst_settings (
  settings_id TINYINT UNSIGNED NOT NULL,
  seller_state_code CHAR(2) NULL,
  cgst_bps SMALLINT UNSIGNED NOT NULL,
  sgst_bps SMALLINT UNSIGNED NOT NULL,
  igst_bps SMALLINT UNSIGNED NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by_type VARCHAR(16) NULL,
  updated_by_id INT NULL,
  PRIMARY KEY (settings_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO admin_metal_gst_settings
  (settings_id, seller_state_code, cgst_bps, sgst_bps, igst_bps)
VALUES
  (1, 'MH', 150, 150, 300)
ON DUPLICATE KEY UPDATE settings_id = VALUES(settings_id);
