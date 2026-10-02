SET @competition_game_details_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'competition_entries'
    AND COLUMN_NAME = 'game_details'
);

SET @competition_game_details_sql = IF(
  @competition_game_details_exists = 0,
  'ALTER TABLE competition_entries ADD COLUMN game_details JSON DEFAULT NULL COMMENT ''競技固有の複数選択などの構造化情報'' AFTER rank_details',
  'SELECT 1'
);

PREPARE competition_game_details_statement FROM @competition_game_details_sql;
EXECUTE competition_game_details_statement;
DEALLOCATE PREPARE competition_game_details_statement;
