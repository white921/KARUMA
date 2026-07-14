-- 市場ガチャのショップ割引券を所持・消費するためのテーブル
CREATE TABLE IF NOT EXISTS shop_tickets (
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  ticket_type VARCHAR(32) NOT NULL COMMENT 'DISCOUNT_5 または DISCOUNT_10',
  quantity INTEGER NOT NULL DEFAULT 0 COMMENT '所持枚数',
  PRIMARY KEY (user_id, ticket_type),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='市場ガチャで付与したショップ割引券';
