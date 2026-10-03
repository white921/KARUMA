-- Reporting only. Never modifies wallets, actions or the game ledger.
CREATE TABLE IF NOT EXISTS levelia_game_high_low_daily_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  report_date DATE NOT NULL,
  user_id BIGINT NOT NULL,
  wager_total BIGINT UNSIGNED NOT NULL,
  payout_total BIGINT UNSIGNED NOT NULL,
  net_amount BIGINT NOT NULL,
  dm_state VARCHAR(16) NOT NULL,
  attempted_at DATETIME(3) DEFAULT NULL,
  delivered_at DATETIME(3) DEFAULT NULL,
  message_id VARCHAR(20) DEFAULT NULL,
  dm_error VARCHAR(64) DEFAULT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_high_low_daily_user (report_date, user_id),
  KEY idx_high_low_daily_history (user_id, report_date),
  KEY idx_high_low_daily_delivery (dm_state, report_date, id)
);

CREATE TABLE IF NOT EXISTS levelia_game_high_low_daily_state (
  id TINYINT NOT NULL PRIMARY KEY,
  next_report_date DATE NOT NULL,
  notify_from_date DATE NOT NULL,
  created_at DATETIME(3) NOT NULL
);

-- Backfill old history. DM-related columns remain only for compatibility with existing deployments.
INSERT IGNORE INTO levelia_game_high_low_daily_state
  (id, next_report_date, notify_from_date, created_at)
SELECT 1,
  LEAST(COALESCE(MIN(DATE(DATE_ADD(created_at, INTERVAL 9 HOUR))),
    DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR))),
    DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR))),
  DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR)), UTC_TIMESTAMP(3)
FROM levelia_game_high_low_ledger;
