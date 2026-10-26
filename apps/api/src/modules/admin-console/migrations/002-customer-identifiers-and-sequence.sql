SET @user_id_type = NULL;
SET @user_id_extra = NULL;
SELECT COLUMN_TYPE, EXTRA
INTO @user_id_type, @user_id_extra
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND column_name = 'user_id'
LIMIT 1;

SET @user_id_ddl = IF(
  @user_id_type IS NULL OR LOCATE('auto_increment', LOWER(@user_id_extra)) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE users MODIFY COLUMN user_id ', @user_id_type, ' NOT NULL AUTO_INCREMENT')
);
PREPARE user_id_statement FROM @user_id_ddl;
EXECUTE user_id_statement;
DEALLOCATE PREPARE user_id_statement;

ALTER TABLE users AUTO_INCREMENT = 1;

SET @has_unique_email = (
  SELECT COUNT(*)
  FROM (
    SELECT index_name
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'users'
    GROUP BY index_name
    HAVING MAX(non_unique) = 0 AND COUNT(*) = 1 AND MAX(column_name = 'email') = 1
  ) AS unique_email_indexes
);
SET @email_ddl = IF(
  @has_unique_email > 0,
  'SELECT 1',
  'ALTER TABLE users ADD UNIQUE KEY uq_users_email (email)'
);
PREPARE email_statement FROM @email_ddl;
EXECUTE email_statement;
DEALLOCATE PREPARE email_statement;

SET @has_unique_mobile = (
  SELECT COUNT(*)
  FROM (
    SELECT index_name
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'users'
    GROUP BY index_name
    HAVING MAX(non_unique) = 0 AND COUNT(*) = 1 AND MAX(column_name = 'mobile') = 1
  ) AS unique_mobile_indexes
);
SET @mobile_ddl = IF(
  @has_unique_mobile > 0,
  'SELECT 1',
  'ALTER TABLE users ADD UNIQUE KEY uq_users_mobile (mobile)'
);
PREPARE mobile_statement FROM @mobile_ddl;
EXECUTE mobile_statement;
DEALLOCATE PREPARE mobile_statement;

SET @has_unique_pan = (
  SELECT COUNT(*)
  FROM (
    SELECT index_name
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'admin_customer_profiles'
    GROUP BY index_name
    HAVING MAX(non_unique) = 0 AND COUNT(*) = 1 AND MAX(column_name = 'pan') = 1
  ) AS unique_pan_indexes
);
SET @pan_ddl = IF(
  @has_unique_pan > 0,
  'SELECT 1',
  'ALTER TABLE admin_customer_profiles ADD UNIQUE KEY uq_admin_customer_profiles_pan (pan)'
);
PREPARE pan_statement FROM @pan_ddl;
EXECUTE pan_statement;
DEALLOCATE PREPARE pan_statement;
