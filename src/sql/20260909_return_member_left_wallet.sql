-- 出戻り時に表示する、鯖抜け時点の残高を保存する。
-- 新規DBには createTable.sql の定義が含まれる。

SET @left_wallet_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'accounts'
    AND column_name = 'left_wallet'
);
SET @add_left_wallet_column_sql = IF(
  @left_wallet_column_exists = 0,
  'ALTER TABLE accounts ADD COLUMN left_wallet INTEGER DEFAULT NULL COMMENT ''鯖抜け時点の残高'' AFTER left_at',
  'SELECT 1'
);
PREPARE add_left_wallet_column FROM @add_left_wallet_column_sql;
EXECUTE add_left_wallet_column;
DEALLOCATE PREPARE add_left_wallet_column;
