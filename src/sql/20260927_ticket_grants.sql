CREATE TABLE IF NOT EXISTS ticket_grants (
  operation_id VARCHAR(32) NOT NULL,
  user_id BIGINT NOT NULL,
  operator_user_id BIGINT NOT NULL,
  item_key VARCHAR(64) NOT NULL,
  quantity INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason VARCHAR(256) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (operation_id),
  INDEX idx_ticket_grants_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理コマンドのチケット付与履歴・二重付与防止';
