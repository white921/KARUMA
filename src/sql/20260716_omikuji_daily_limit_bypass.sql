-- 技術統括はおみくじを同日に複数回引けるようにする。
-- 通常メンバーの一日一回制限はアプリケーション側で判定する。

SET @has_unique_index := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'omikuji_draws'
    AND index_name = 'uq_omikuji_draws_user_date'
);
SET @drop_unique_index_sql := IF(
  @has_unique_index > 0,
  'ALTER TABLE omikuji_draws DROP INDEX uq_omikuji_draws_user_date',
  'SELECT 1'
);
PREPARE drop_unique_index_statement FROM @drop_unique_index_sql;
EXECUTE drop_unique_index_statement;
DEALLOCATE PREPARE drop_unique_index_statement;

SET @has_lookup_index := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'omikuji_draws'
    AND index_name = 'idx_omikuji_draws_user_date'
);
SET @add_lookup_index_sql := IF(
  @has_lookup_index = 0,
  'ALTER TABLE omikuji_draws ADD INDEX idx_omikuji_draws_user_date (user_id, draw_date)',
  'SELECT 1'
);
PREPARE add_lookup_index_statement FROM @add_lookup_index_sql;
EXECUTE add_lookup_index_statement;
DEALLOCATE PREPARE add_lookup_index_statement;
