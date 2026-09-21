-- 2026-09-22 00:00:00 JST (= 2026-09-21 15:00:00 UTC) に自動加算と過去分付与を開始。
-- このマイグレーション自体はコイン残高を変更しない。
CREATE TABLE IF NOT EXISTS gacha_coin_rollouts (
  rollout_key VARCHAR(16) NOT NULL,
  activation_epoch BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  historical_draw_count INTEGER NOT NULL DEFAULT 0,
  credited_user_count INTEGER NOT NULL DEFAULT 0,
  credited_coin_count INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP DEFAULT NULL,
  PRIMARY KEY (rollout_key)
) ENGINE=InnoDB COMMENT='ガチャコイン自動加算の開始時刻と過去分付与状態';

INSERT INTO gacha_coin_rollouts (rollout_key, activation_epoch)
VALUES ('20260922', 1790002800)
ON DUPLICATE KEY UPDATE rollout_key = rollout_key;
