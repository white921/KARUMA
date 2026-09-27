-- 所持数・交換履歴は変更せず、新チケット定義のみ追加する。
INSERT INTO items (item_key, name, description) VALUES
  ('CAST_TWOSHOT_FIRST_FREE', '執事・メイドツーショ30分初回無料チケット', 'ツーショ30分を無料で利用できる券。ガチャコイン15枚で1人1回のみ交換可能')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);
