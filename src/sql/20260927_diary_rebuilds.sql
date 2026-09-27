CREATE TABLE IF NOT EXISTS diary_rebuilds (
  id VARCHAR(36) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  old_thread_id BIGINT NOT NULL,
  new_thread_id BIGINT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_diary_rebuild_user (user_id, status),
  INDEX idx_diary_rebuild_recovery (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
