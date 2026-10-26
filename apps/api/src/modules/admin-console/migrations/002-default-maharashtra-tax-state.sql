UPDATE admin_metal_gst_settings
SET seller_state_code = 'MH'
WHERE settings_id = 1 AND seller_state_code IS NULL;

INSERT INTO admin_metal_gst_settings
  (settings_id, seller_state_code, cgst_bps, sgst_bps, igst_bps)
VALUES
  (1, 'MH', 150, 150, 300)
ON DUPLICATE KEY UPDATE
  seller_state_code = COALESCE(seller_state_code, 'MH');

ALTER TABLE admin_metal_gst_settings
  MODIFY seller_state_code CHAR(2) NOT NULL DEFAULT 'MH';
