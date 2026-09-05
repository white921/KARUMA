-- 転送VCは口座未開設ユーザーも作成者になれるため、vcs.owner_id と accounts.user_id の外部キーを外す。
-- 既に外部キーがない環境でも再実行できる。

SET @vcs_owner_account_fk := (
  SELECT constraint_name
  FROM information_schema.key_column_usage
  WHERE constraint_schema = DATABASE()
    AND table_name = 'vcs'
    AND column_name = 'owner_id'
    AND referenced_table_name = 'accounts'
  LIMIT 1
);

SET @drop_vcs_owner_account_fk_sql := IF(
  @vcs_owner_account_fk IS NOT NULL,
  CONCAT('ALTER TABLE vcs DROP FOREIGN KEY `', @vcs_owner_account_fk, '`'),
  'SELECT 1'
);
PREPARE drop_vcs_owner_account_fk_statement FROM @drop_vcs_owner_account_fk_sql;
EXECUTE drop_vcs_owner_account_fk_statement;
DEALLOCATE PREPARE drop_vcs_owner_account_fk_statement;
