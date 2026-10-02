SET @competition_rank_division_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'competition_entries'
    AND COLUMN_NAME = 'rank_division'
);

SET @competition_rank_division_sql = IF(
  @competition_rank_division_exists = 0,
  'ALTER TABLE competition_entries ADD COLUMN rank_division VARCHAR(16) DEFAULT NULL COMMENT ''クラス・段階・ディビジョン等の数値'' AFTER rank_name',
  'SELECT 1'
);

PREPARE competition_rank_division_statement FROM @competition_rank_division_sql;
EXECUTE competition_rank_division_statement;
DEALLOCATE PREPARE competition_rank_division_statement;
