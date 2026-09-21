-- ガチャ抽選からの自動加算は未接続。手動付与・減算・アイテム交換を記録する。
CREATE TABLE IF NOT EXISTS gacha_coin_balances (
  user_id BIGINT NOT NULL,
  coins INTEGER UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='ガチャコイン残高';

CREATE TABLE IF NOT EXISTS gacha_coin_transactions (
  operation_id VARCHAR(32) NOT NULL,
  user_id BIGINT NOT NULL,
  operator_user_id BIGINT DEFAULT NULL,
  transaction_type VARCHAR(16) NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER UNSIGNED NOT NULL,
  item_key VARCHAR(64) DEFAULT NULL,
  reason VARCHAR(256) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (operation_id),
  KEY idx_gacha_coin_user (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='ガチャコイン付与・減算・交換履歴';

CREATE TABLE IF NOT EXISTS gacha_coin_exchange_requests (
  request_id VARCHAR(20) NOT NULL,
  user_id BIGINT NOT NULL,
  reward_key VARCHAR(16) NOT NULL,
  cost INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (request_id),
  KEY idx_gacha_coin_request_user (user_id),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='ガチャコイン交換確認';
