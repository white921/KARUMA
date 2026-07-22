-- ルーレットの手動イベントキーを廃止する。
-- 実行前に、受付中・締切済みのラウンドがないことを確認すること。

ALTER TABLE roulette_rounds
  DROP INDEX idx_roulette_rounds_event_status,
  DROP COLUMN event_key,
  ADD KEY idx_roulette_rounds_status (status);

CREATE TABLE IF NOT EXISTS roulette_bonus_batches (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '配布バッチID',
  last_round_id INTEGER NOT NULL COMMENT 'この配布に含めた最後のラウンドID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roulette_bonus_batch_last_round (last_round_id),
  FOREIGN KEY (last_round_id) REFERENCES roulette_rounds(id) ON DELETE RESTRICT
)
COMMENT='ヨーロピアンルーレット参加ボーナスの配布区切り';

ALTER TABLE roulette_participation_rewards
  DROP INDEX uq_roulette_event_reward,
  DROP COLUMN event_key,
  ADD COLUMN bonus_batch_id INTEGER NOT NULL COMMENT '配布バッチID' AFTER id,
  ADD UNIQUE KEY uq_roulette_bonus_batch_reward (bonus_batch_id, user_id),
  ADD CONSTRAINT fk_roulette_reward_bonus_batch
    FOREIGN KEY (bonus_batch_id) REFERENCES roulette_bonus_batches(id) ON DELETE CASCADE;
