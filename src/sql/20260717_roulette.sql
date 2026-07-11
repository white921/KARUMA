-- 2026-07-17 ヨーロピアンルーレット機能
-- すべて CREATE TABLE IF NOT EXISTS のため、既存テーブルやデータは変更しない。

CREATE TABLE IF NOT EXISTS roulette_rounds (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'ラウンドID',
  event_key VARCHAR(64) NOT NULL COMMENT 'イベント識別子',
  stage TINYINT NOT NULL COMMENT '部（1〜3）',
  status ENUM('open', 'closed', 'settled') NOT NULL DEFAULT 'open' COMMENT '受付状態',
  result_number TINYINT DEFAULT NULL COMMENT '結果（0〜36）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  closed_at TIMESTAMP DEFAULT NULL,
  settled_at TIMESTAMP DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_roulette_rounds_event_status (event_key, status)
)
COMMENT='ヨーロピアンルーレットのラウンド';

CREATE TABLE IF NOT EXISTS roulette_bets (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'ベットID',
  round_id INTEGER NOT NULL COMMENT 'ラウンドID',
  user_id BIGINT NOT NULL COMMENT '参加者のDiscordユーザーID',
  bet_kind VARCHAR(16) NOT NULL COMMENT '賭け種別',
  selection VARCHAR(16) NOT NULL COMMENT '選択内容',
  amount INTEGER NOT NULL COMMENT '賭け金',
  payout INTEGER NOT NULL DEFAULT 0 COMMENT '配当額',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  settled_at TIMESTAMP DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roulette_round_user (round_id, user_id),
  KEY idx_roulette_bets_user (user_id),
  FOREIGN KEY (round_id) REFERENCES roulette_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='ヨーロピアンルーレットの確定ベット';

CREATE TABLE IF NOT EXISTS roulette_participation_rewards (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '配布ID',
  event_key VARCHAR(64) NOT NULL COMMENT 'イベント識別子',
  user_id BIGINT NOT NULL COMMENT '参加者のDiscordユーザーID',
  amount INTEGER NOT NULL COMMENT '配布額',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roulette_event_reward (event_key, user_id),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='ヨーロピアンルーレット参加ボーナス';
