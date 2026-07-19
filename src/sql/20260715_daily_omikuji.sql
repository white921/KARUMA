-- おみくじの抽選履歴。
CREATE TABLE IF NOT EXISTS omikuji_draws (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'おみくじ抽選ID',
  user_id BIGINT NOT NULL COMMENT '抽選したDiscordユーザーID',
  draw_date DATE NOT NULL COMMENT '日本時間の抽選日',
  fortune VARCHAR(16) NOT NULL COMMENT '小吉・中吉・大吉・凶・超大吉',
  amount INTEGER NOT NULL COMMENT '増減通貨額',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '抽選日時',
  PRIMARY KEY (id),
  KEY idx_omikuji_draws_user_date (user_id, draw_date),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='おみくじ抽選履歴';
