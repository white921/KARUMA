-- 接続中のデータベースにテーブルを作成する
-- Railway では MYSQL_DATABASE で指定された DB に接続してから実行する

-- アカウントテーブル
CREATE TABLE IF NOT EXISTS accounts (
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  user_name VARCHAR(64) NOT NULL COMMENT 'ユーザーの表示名',
  wallet INTEGER NOT NULL DEFAULT 0 COMMENT '残高',
  is_frozen BOOLEAN NOT NULL DEFAULT FALSE COMMENT '凍結状態',
  left_count INTEGER NOT NULL DEFAULT 0 COMMENT '鯖抜け回数',
  left_at TIMESTAMP DEFAULT NULL COMMENT '鯖抜け日時',
  left_core_member_roles BIGINT DEFAULT NULL COMMENT '鯖抜け時点の基本ロール',
  boost_count INTEGER NOT NULL DEFAULT 0 COMMENT 'サーバーブースト回数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '作成日時',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL COMMENT '更新日時',
  PRIMARY KEY (user_id)
)
COMMENT='ユーザーアカウント情報';

-- アクションテーブル
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'アクションID',
  command_name VARCHAR(32) NOT NULL COMMENT 'コマンド名',
  amount INTEGER NOT NULL COMMENT '金額',
  from_user_id BIGINT NOT NULL COMMENT 'アクション実行ユーザーID',
  to_user_id BIGINT NOT NULL COMMENT '対象ユーザーID',
  from_after_wallet INTEGER NOT NULL COMMENT '送金元ユーザーのアクション後の残高',
  to_after_wallet INTEGER NOT NULL COMMENT '送金先ユーザーのアクション後の残高',
  comment VARCHAR(256) DEFAULT '' COMMENT '備考',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '実行日時',
  PRIMARY KEY (id),
  FOREIGN KEY (from_user_id) REFERENCES accounts(user_id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='アクションログ';

-- サブ垢管理テーブル
CREATE TABLE IF NOT EXISTS sub_accounts (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'サブ垢管理ID',
  main_user_id BIGINT NOT NULL COMMENT '親アカウントID',
  sub_user_id BIGINT NOT NULL COMMENT 'サブアカウントID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '作成日時',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL COMMENT '更新日時',
  PRIMARY KEY (id),
  UNIQUE KEY uq_main_sub (main_user_id, sub_user_id),
  FOREIGN KEY (main_user_id) REFERENCES accounts(user_id) ON DELETE CASCADE,
  FOREIGN KEY (sub_user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='サブアカウント管理';

-- vcテーブル
CREATE TABLE IF NOT EXISTS vcs (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'VCID',
  channel_id BIGINT NOT NULL COMMENT 'DiscordチャンネルID',
  owner_id BIGINT NOT NULL COMMENT '作成者のDiscordユーザーID',
  guest_id BIGINT DEFAULT NULL COMMENT 'ゲストのDiscordユーザーID',
  type VARCHAR(32) NOT NULL COMMENT 'VCタイプ',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '有効状態（削除済みでfalse）',
  is_ticket BOOLEAN DEFAULT FALSE COMMENT 'チケットを消費して作成したかどうか', 
  is_bonus BOOLEAN DEFAULT FALSE COMMENT '特典(ロール)を利用して作成したかどうか',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '作成日時',
  expire_at TIMESTAMP DEFAULT NULL COMMENT '有償VCの場合の有効期限',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL COMMENT '更新日時',
  PRIMARY KEY (id),
  FOREIGN KEY (owner_id) REFERENCES accounts(user_id)
)
COMMENT='VC情報';

-- -- ガチャ景品テーブル
-- CREATE TABLE IF NOT EXISTS items (
--   id INTEGER NOT NULL AUTO_INCREMENT COMMENT '景品ID',
--   name VARCHAR(64) NOT NULL COMMENT '景品名',
--   PRIMARY KEY (id)
-- )
-- COMMENT='景品情報';

-- -- 景品とアカウントの中間テーブル
-- CREATE TABLE IF NOT EXISTS account_items (
--   id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'アカウント景品ID',
--   user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
--   item_id INTEGER NOT NULL COMMENT '景品ID',
--   quantity INTEGER NOT NULL DEFAULT 0 COMMENT '所持数',
--   PRIMARY KEY (id),
--   FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE,
--   FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
-- )
-- COMMENT='アカウントの景品所持情報';

-- ロール管理テーブル（複数のロールを管理可能）
CREATE TABLE IF NOT EXISTS role_management_logs (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'ロール管理ID',
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  role_id BIGINT NOT NULL COMMENT 'DiscordロールID',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'ロールが剥奪されたかどうか',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'ロール付与日時',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL COMMENT 'ロール更新日時',
  expire_at TIMESTAMP DEFAULT NULL COMMENT 'ロール有効期限',
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_role (user_id, role_id)
)
COMMENT='ロール管理情報（有効期限付きロールの管理）';

-- 日記テーブル
CREATE TABLE IF NOT EXISTS diaries (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '日記ID',
  thread_id BIGINT NOT NULL COMMENT 'DiscordスレッドID',
  creator_user_id BIGINT NOT NULL COMMENT '日記作成者のDiscordユーザーID',
  type VARCHAR(32) NOT NULL COMMENT '日記種別',
  is_private BOOLEAN NOT NULL DEFAULT FALSE COMMENT '本人限定日記かどうか',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '日記がアクティブかどうか',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '作成日時',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL COMMENT '更新日時',
  PRIMARY KEY (id),
  UNIQUE KEY uq_diary_thread (thread_id),
  UNIQUE KEY uq_diary_creator (creator_user_id),
  FOREIGN KEY (creator_user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='日記情報';

-- Bot口座
-- 各種購入・付与・減額ログが参照するため、初期状態で用意する
INSERT INTO accounts (user_id, user_name, wallet)
VALUES (1521705594912772227, 'KARUMA Bot', 0)
ON DUPLICATE KEY UPDATE
  user_name = VALUES(user_name);

-- ヨーロピアンルーレット：ラウンド管理
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

-- 確定済みベット。1ラウンドにつき参加者は一賭けだけ。
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

-- イベント後の参加ボーナスの二重配布を防ぐ。
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

-- -- 評価管理テーブル
-- CREATE TABLE IF NOT EXISTS evaluations (
--   id INTEGER NOT NULL AUTO_INCREMENT COMMENT '評価ID',
--   user_id BIGINT NOT NULL COMMENT '評価を受けるユーザーID',
--   male_invites INT DEFAULT 0 COMMENT '男性の招待数',
--   female_invites INT DEFAULT 0 COMMENT '女性の招待数',
--   total_invite_extension_days INT DEFAULT 0 COMMENT '招待にる累計評価期間延長日数',
--   total_bonus_extension_days INT DEFAULT 0 COMMENT '特典などによる累計評価期間延長日数',
--   total_bonus_maru INT DEFAULT 0 COMMENT '特典などによる⭕️の数',
--   reason VARCHAR(1024) DEFAULT '' COMMENT '評価延長理由',
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '評価シート作成日時',
--   expire_at TIMESTAMP DEFAULT NULL COMMENT '評価有効期限',
--   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL COMMENT '評価シート更新日時',
--   PRIMARY KEY (id)
-- )
-- COMMENT='ユーザーの評価管理情報';
