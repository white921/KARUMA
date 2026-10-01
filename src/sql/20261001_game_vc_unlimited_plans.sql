-- 遊戯VCを人数別・時間無制限プランへ移行する。
-- 既存VCは game_plan=NULL のまま旧24時間仕様を維持し、新規VCだけ新仕様として保存する。

SET @game_plan_column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'vcs' AND column_name = 'game_plan'
);
SET @game_plan_column_sql := IF(
  @game_plan_column_exists = 0,
  'ALTER TABLE vcs ADD COLUMN game_plan VARCHAR(16) DEFAULT NULL COMMENT ''新遊戯VCのlimitedまたはunlimited。NULLは旧仕様'' AFTER expire_at',
  'SELECT 1'
);
PREPARE game_plan_column_statement FROM @game_plan_column_sql;
EXECUTE game_plan_column_statement;
DEALLOCATE PREPARE game_plan_column_statement;

SET @owner_has_joined_column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'vcs' AND column_name = 'owner_has_joined'
);
SET @owner_has_joined_column_sql := IF(
  @owner_has_joined_column_exists = 0,
  'ALTER TABLE vcs ADD COLUMN owner_has_joined BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''新遊戯VCで部屋主が一度以上入室したか'' AFTER game_plan',
  'SELECT 1'
);
PREPARE owner_has_joined_column_statement FROM @owner_has_joined_column_sql;
EXECUTE owner_has_joined_column_statement;
DEALLOCATE PREPARE owner_has_joined_column_statement;

SET @owner_left_at_column_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'vcs' AND column_name = 'owner_left_at'
);
SET @owner_left_at_column_sql := IF(
  @owner_left_at_column_exists = 0,
  'ALTER TABLE vcs ADD COLUMN owner_left_at TIMESTAMP DEFAULT NULL COMMENT ''新遊戯VCで部屋主が最後に退出した日時'' AFTER owner_has_joined',
  'SELECT 1'
);
PREPARE owner_left_at_column_statement FROM @owner_left_at_column_sql;
EXECUTE owner_left_at_column_statement;
DEALLOCATE PREPARE owner_left_at_column_statement;

SET @game_owner_cleanup_index_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'vcs' AND index_name = 'idx_vcs_game_owner_cleanup'
);
SET @game_owner_cleanup_index_sql := IF(
  @game_owner_cleanup_index_exists = 0,
  'ALTER TABLE vcs ADD INDEX idx_vcs_game_owner_cleanup (type, is_active, game_plan, owner_left_at)',
  'SELECT 1'
);
PREPARE game_owner_cleanup_index_statement FROM @game_owner_cleanup_index_sql;
EXECUTE game_owner_cleanup_index_statement;
DEALLOCATE PREPARE game_owner_cleanup_index_statement;

CREATE TABLE IF NOT EXISTS game_ticket_rollouts (
  rollout_key VARCHAR(32) NOT NULL,
  affected_user_count INTEGER NOT NULL DEFAULT 0,
  before_quantity BIGINT NOT NULL DEFAULT 0,
  after_quantity BIGINT NOT NULL DEFAULT 0,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rollout_key)
) COMMENT='遊戯チケット一括移行の重複実行防止';

START TRANSACTION;
INSERT IGNORE INTO game_ticket_rollouts (rollout_key)
VALUES ('20261001_double_inventory');
SET @apply_game_ticket_double := ROW_COUNT();
SET @game_ticket_before_quantity := (
  SELECT COALESCE(SUM(item_users.quantity), 0)
  FROM item_users
  INNER JOIN items ON items.id = item_users.item_id
  WHERE items.item_key = 'GAME_SHORT_FREE'
);
SET @game_ticket_affected_users := (
  SELECT COUNT(*)
  FROM item_users
  INNER JOIN items ON items.id = item_users.item_id
  WHERE items.item_key = 'GAME_SHORT_FREE' AND item_users.quantity > 0
);
UPDATE item_users
INNER JOIN items ON items.id = item_users.item_id
SET item_users.quantity = item_users.quantity * 2
WHERE items.item_key = 'GAME_SHORT_FREE'
  AND @apply_game_ticket_double = 1;
UPDATE game_ticket_rollouts
SET affected_user_count = IF(@apply_game_ticket_double = 1, @game_ticket_affected_users, affected_user_count),
    before_quantity = IF(@apply_game_ticket_double = 1, @game_ticket_before_quantity, before_quantity),
    after_quantity = IF(@apply_game_ticket_double = 1, @game_ticket_before_quantity * 2, after_quantity),
    completed_at = IF(@apply_game_ticket_double = 1, CURRENT_TIMESTAMP, completed_at)
WHERE rollout_key = '20261001_double_inventory';
UPDATE items
SET name = '遊戯チケット',
    description = '時間無制限の遊戯VC作成に使用できる券'
WHERE item_key = 'GAME_SHORT_FREE';
COMMIT;
