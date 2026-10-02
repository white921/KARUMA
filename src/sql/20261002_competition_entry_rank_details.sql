SET @competition_rank_details_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'competition_entries'
    AND COLUMN_NAME = 'rank_details'
);

SET @competition_rank_details_sql = IF(
  @competition_rank_details_exists = 0,
  'ALTER TABLE competition_entries ADD COLUMN rank_details JSON DEFAULT NULL COMMENT ''ロール別など複数ランクの構造化情報'' AFTER rank_division',
  'SELECT 1'
);

PREPARE competition_rank_details_statement FROM @competition_rank_details_sql;
EXECUTE competition_rank_details_statement;
DEALLOCATE PREPARE competition_rank_details_statement;
