-- 招待ポイントによる市場ガチャ機能
-- 既存DBでは、デプロイ前にこのファイルを一度だけ適用してください。

-- MySQL 9.4 は ADD COLUMN IF NOT EXISTS をサポートしないため、information_schemaで存在確認してから追加する。
SET @add_payment_source_sql := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'market_gacha_draws'
        AND column_name = 'payment_source'
    ),
    'SELECT 1',
    'ALTER TABLE market_gacha_draws ADD COLUMN payment_source VARCHAR(16) NOT NULL DEFAULT ''currency'' COMMENT ''currency または invite_point'' AFTER prize_name'
  )
);
PREPARE add_payment_source FROM @add_payment_source_sql;
EXECUTE add_payment_source;
DEALLOCATE PREPARE add_payment_source;

CREATE TABLE IF NOT EXISTS invite_point_balances (
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  points INTEGER NOT NULL DEFAULT 0 COMMENT '現在の招待ポイント',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='招待ポイント残高';

CREATE TABLE IF NOT EXISTS invite_point_transactions (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '招待ポイント取引ID',
  user_id BIGINT NOT NULL COMMENT '対象DiscordユーザーID',
  operator_user_id BIGINT DEFAULT NULL COMMENT '付与実行者。ガチャ消費時はNULL',
  transaction_type VARCHAR(32) NOT NULL COMMENT 'grant または gacha_draw',
  amount INTEGER NOT NULL COMMENT '増減ポイント。消費は負数',
  balance_after INTEGER NOT NULL COMMENT '取引後残高',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_invite_point_transactions_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='招待ポイント付与・消費履歴';
