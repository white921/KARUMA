-- サーバーブースト報酬の回数管理・重複支給防止
-- 既存DBに適用する。新規DBには createTable.sql の定義が含まれる。

SET @boost_count_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'accounts'
    AND column_name = 'boost_count'
);
SET @add_boost_count_column_sql = IF(
  @boost_count_column_exists = 0,
  'ALTER TABLE accounts ADD COLUMN boost_count INTEGER NOT NULL DEFAULT 0 COMMENT ''サーバーブースト回数'' AFTER left_core_member_roles',
  'SELECT 1'
);
PREPARE add_boost_count_column FROM @add_boost_count_column_sql;
EXECUTE add_boost_count_column;
DEALLOCATE PREPARE add_boost_count_column;

CREATE TABLE IF NOT EXISTS server_boost_rewards (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'サーバーブースト報酬ID',
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  boost_started_at BIGINT NOT NULL COMMENT '今回のブースト開始日時（Unixミリ秒）',
  boost_count INTEGER NOT NULL COMMENT '累計ブースト回数',
  amount INTEGER NOT NULL COMMENT '付与通貨額',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '付与日時',
  PRIMARY KEY (id),
  UNIQUE KEY uq_server_boost_rewards_user_start (user_id, boost_started_at),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='サーバーブースト報酬履歴';
