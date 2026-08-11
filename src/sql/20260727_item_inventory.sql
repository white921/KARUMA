-- チケットを共通アイテム在庫へ移行する。
CREATE TABLE IF NOT EXISTS items (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'アイテムID',
  item_key VARCHAR(64) NOT NULL COMMENT 'アイテム識別子',
  name VARCHAR(128) NOT NULL COMMENT '表示名',
  description VARCHAR(255) NOT NULL DEFAULT '' COMMENT '説明',
  PRIMARY KEY (id),
  UNIQUE KEY uq_items_item_key (item_key)
)
COMMENT='アイテム定義';

CREATE TABLE IF NOT EXISTS item_users (
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  item_id INTEGER NOT NULL COMMENT 'アイテムID',
  quantity INTEGER NOT NULL DEFAULT 0 COMMENT '所持数',
  PRIMARY KEY (user_id, item_id),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
)
COMMENT='ユーザーのアイテム所持情報';

INSERT INTO items (item_key, name, description) VALUES
  ('HOTEL_SECRET_FREE', 'VIPホテル無料券', 'VIPホテル（12時間）を無料で利用できる券'),
  ('HOTEL_FREEDOM_FREE', 'フリーダム無料券', 'フリーダム（12時間）を無料で利用できる券'),
  ('SHOP_DISCOUNT_5', 'ショップ割引券 5%OFF', '100万LIA未満のショップ支払いに使える5%割引券'),
  ('SHOP_DISCOUNT_10', 'ショップ割引券 10%OFF', '100万LIA未満のショップ支払いに使える10%割引券'),
  ('GAME_SHORT_FREE', '遊戯チケット', 'ゲームの6時間プランを無料で利用できる券')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT IGNORE INTO item_users (user_id, item_id, quantity)
SELECT hotel_free_tickets.user_id, items.id, hotel_free_tickets.quantity
FROM hotel_free_tickets
INNER JOIN items ON items.item_key = CONCAT('HOTEL_', hotel_free_tickets.ticket_type, '_FREE')
WHERE hotel_free_tickets.quantity > 0;

INSERT IGNORE INTO item_users (user_id, item_id, quantity)
SELECT shop_tickets.user_id, items.id, shop_tickets.quantity
FROM shop_tickets
INNER JOIN items ON items.item_key = CONCAT('SHOP_', shop_tickets.ticket_type)
WHERE shop_tickets.quantity > 0;

INSERT IGNORE INTO item_users (user_id, item_id, quantity)
SELECT game_free_tickets.user_id, items.id, game_free_tickets.quantity
FROM game_free_tickets
INNER JOIN items ON items.item_key = 'GAME_SHORT_FREE'
WHERE game_free_tickets.ticket_type = 'SHORT' AND game_free_tickets.quantity > 0;
