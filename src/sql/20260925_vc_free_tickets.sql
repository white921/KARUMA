-- 狭間・独房の無料券定義のみ追加。所持数やガチャ景品は変更しない。
INSERT INTO items (item_key, name, description) VALUES
  ('HAZAMA_FREE', '辺境の狭間無料券', '辺境の狭間の滞在許可証（12時間）を無料で取得できる券'),
  ('SOLITARY_CELL_FREE', '独房無料券', '独房を1部屋（12時間）無料で作成できる券')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);
