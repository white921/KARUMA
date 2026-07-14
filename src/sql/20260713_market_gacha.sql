-- 市場ガチャ。created_at は UTC 保存を前提に、アプリ側で日本時間の日次上限を判定する。
CREATE TABLE IF NOT EXISTS market_gacha_draws (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '抽選ID',
  user_id BIGINT NOT NULL COMMENT '抽選したDiscordユーザーID',
  prize_key VARCHAR(64) NOT NULL COMMENT '景品識別子',
  prize_name VARCHAR(128) NOT NULL COMMENT '抽選時点の景品名',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '抽選日時',
  PRIMARY KEY (id),
  KEY idx_market_gacha_draws_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='市場ガチャ抽選履歴';

CREATE TABLE IF NOT EXISTS hotel_free_tickets (
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  ticket_type VARCHAR(16) NOT NULL COMMENT 'SECRET または FREEDOM（いずれも12時間）',
  quantity INTEGER NOT NULL DEFAULT 0 COMMENT '所持枚数',
  PRIMARY KEY (user_id, ticket_type),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='市場ガチャで付与したホテル無料券';
