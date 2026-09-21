-- キャスト支払いの詳細・二重決済防止用。既存の口座とactionsは同じトランザクションで更新する。
CREATE TABLE IF NOT EXISTS cast_payments (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  menu VARCHAR(16) NOT NULL,
  cast_ids JSON NOT NULL,
  hours INT NOT NULL,
  amount INT NOT NULL,
  option_text VARCHAR(500) NOT NULL DEFAULT '',
  log_thread_id VARCHAR(32) NOT NULL,
  log_message_id VARCHAR(32) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
