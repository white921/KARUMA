CREATE TABLE IF NOT EXISTS dark_message_disclosure_confirmations (
  confirmation_id VARCHAR(20) NOT NULL PRIMARY KEY,
  request_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  amount INT NOT NULL,
  status ENUM('pending', 'cancelled', 'completed') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_dark_disclosure_confirmation_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- request_idを一意にし、確認画面の作り直し・再起動後も1通につき1回だけ課金する。
CREATE TABLE IF NOT EXISTS dark_message_disclosures (
  request_id VARCHAR(20) NOT NULL PRIMARY KEY,
  confirmation_id VARCHAR(20) NOT NULL,
  payer_id VARCHAR(20) NOT NULL,
  amount INT NOT NULL,
  after_wallet INT NOT NULL,
  action_id INT NOT NULL,
  disclosed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dark_disclosure_confirmation (confirmation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
