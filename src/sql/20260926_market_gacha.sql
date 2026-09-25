-- 2026-09-26 00:00 JST以降のみ本番適用。既存抽選・ポイント・コイン残高は変更しない。
INSERT INTO items (item_key, name, description) VALUES
  ('HOTEL_NORMAL_FREE', '通常ホテル無料券', '通常ホテル（12時間）を無料で利用できる券')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

SET @market_gacha_bonus_column_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'market_gacha_draws' AND COLUMN_NAME = 'bonus_draws_awarded'
);
SET @market_gacha_bonus_sql = IF(@market_gacha_bonus_column_exists = 0,
  'ALTER TABLE market_gacha_draws ADD COLUMN bonus_draws_awarded TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''この抽選で付与した当日の追加抽選枠''',
  'SELECT 1');
PREPARE market_gacha_bonus_stmt FROM @market_gacha_bonus_sql;
EXECUTE market_gacha_bonus_stmt;
DEALLOCATE PREPARE market_gacha_bonus_stmt;
