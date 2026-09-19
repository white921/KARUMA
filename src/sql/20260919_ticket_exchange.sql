-- 確認内容を永続化し、同じ確認ボタンの再送・再起動後の二重換金を防止する。
CREATE TABLE IF NOT EXISTS ticket_exchange_requests (
  request_id VARCHAR(20) NOT NULL,
  user_id BIGINT NOT NULL,
  item_key VARCHAR(64) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  after_wallet INTEGER DEFAULT NULL,
  after_quantity INTEGER DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (request_id),
  KEY idx_ticket_exchange_user (user_id),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='チケット換金の確認情報と実行履歴';
