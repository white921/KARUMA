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

CREATE TABLE IF NOT EXISTS server_boost_rewards (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'サーバーブースト報酬ID',
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  boost_started_at BIGINT NOT NULL COMMENT '今回のブースト開始日時（Unixミリ秒）',
  boost_count INTEGER NOT NULL COMMENT '累計ブースト回数',
  amount INTEGER NOT NULL COMMENT '増減通貨額',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT '付与日時',
  PRIMARY KEY (id),
  UNIQUE KEY uq_server_boost_rewards_user_start (user_id, boost_started_at),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='サーバーブースト報酬履歴';

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

CREATE TABLE IF NOT EXISTS items (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'アイテムID',
  item_key VARCHAR(64) NOT NULL COMMENT 'アイテム識別子',
  name VARCHAR(128) NOT NULL COMMENT '表示名',
  description VARCHAR(255) NOT NULL DEFAULT '' COMMENT '説明',
  PRIMARY KEY (id),
  UNIQUE KEY uq_items_item_key (item_key)
)
COMMENT='アイテム定義';

CREATE TABLE IF NOT EXISTS item_users (
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  item_id INTEGER NOT NULL COMMENT 'アイテムID',
  quantity INTEGER NOT NULL DEFAULT 0 COMMENT '所持数',
  PRIMARY KEY (user_id, item_id),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
)
COMMENT='ユーザーのアイテム所持情報';

INSERT INTO items (item_key, name, description) VALUES
  ('HOTEL_SECRET_FREE', 'VIPホテル無料券', 'VIPホテル（12時間）を無料で利用できる券'),
  ('HOTEL_FREEDOM_FREE', 'フリーダム無料券', 'フリーダム（12時間）を無料で利用できる券'),
  ('SHOP_DISCOUNT_5', '市場割引券 5%OFF', '100万LIA未満の市場支払いに使える5%割引券'),
  ('SHOP_DISCOUNT_10', '市場割引券 10%OFF', '100万LIA未満の市場支払いに使える10%割引券'),
  ('GAME_SHORT_FREE', '遊戯チケット', '遊戯VCを1部屋（12時間）無料で作成できる券')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

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

-- 評価シートの作成・保存・削除・復元管理
CREATE TABLE IF NOT EXISTS evaluation_sheet_sessions (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '評価シートセッションID',
  user_id BIGINT NOT NULL COMMENT '評価対象のDiscordユーザーID',
  created_by_user_id BIGINT NOT NULL COMMENT '評価シートを作成したユーザーID',
  status ENUM('active', 'saved', 'deleted') NOT NULL DEFAULT 'active' COMMENT 'active=運用中、saved=保存済み・削除未完了、deleted=削除済み',
  saved_by_user_id BIGINT DEFAULT NULL COMMENT '保存削除を実行したユーザーID',
  saved_reason VARCHAR(256) DEFAULT NULL COMMENT '保存削除理由',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  saved_at TIMESTAMP DEFAULT NULL,
  deleted_at TIMESTAMP DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_evaluation_sheet_sessions_user_status (user_id, status)
)
COMMENT='評価シートの仮メン期間単位の管理';

CREATE TABLE IF NOT EXISTS evaluation_sheet_threads (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '評価スレッド管理ID',
  session_id INTEGER NOT NULL COMMENT '評価シートセッションID',
  forum_id BIGINT NOT NULL COMMENT '親フォーラムID',
  thread_id BIGINT NOT NULL COMMENT '評価スレッドID',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_evaluation_sheet_threads_thread (thread_id),
  UNIQUE KEY uq_evaluation_sheet_threads_session_forum (session_id, forum_id),
  FOREIGN KEY (session_id) REFERENCES evaluation_sheet_sessions(id) ON DELETE CASCADE
)
COMMENT='評価シートのフォーラム別スレッド対応';

-- 対象ユーザーごとの現在の評価スレッド。新規作成時は user_id + forum_id で更新する。
CREATE TABLE IF NOT EXISTS evaluation_sheet_current_threads (
  user_id BIGINT NOT NULL COMMENT '評価対象のDiscordユーザーID',
  forum_id BIGINT NOT NULL COMMENT '親フォーラムID',
  thread_id BIGINT NOT NULL COMMENT '現在の評価スレッドID',
  session_id INTEGER NOT NULL COMMENT '現在の評価シートセッションID',
  status ENUM('active', 'deleted') NOT NULL DEFAULT 'active' COMMENT '現在有効なスレッドならactive',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, forum_id),
  UNIQUE KEY uq_evaluation_sheet_current_threads_thread (thread_id),
  KEY idx_evaluation_sheet_current_threads_session_status (session_id, status),
  FOREIGN KEY (session_id) REFERENCES evaluation_sheet_sessions(id) ON DELETE CASCADE
)
COMMENT='ユーザーごとの現在の評価スレッド対応';

CREATE TABLE IF NOT EXISTS evaluation_sheet_archives (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '評価アーカイブID',
  session_id INTEGER NOT NULL COMMENT '評価シートセッションID',
  user_id BIGINT NOT NULL COMMENT '評価対象のDiscordユーザーID',
  forum_id BIGINT NOT NULL COMMENT '元フォーラムID',
  source_thread_id BIGINT NOT NULL COMMENT '保存元スレッドID',
  transcript_html LONGTEXT NOT NULL COMMENT 'HTML形式の評価ログ',
  message_count INTEGER NOT NULL DEFAULT 0 COMMENT '保存メッセージ数',
  archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_evaluation_sheet_archives_session_forum (session_id, forum_id),
  KEY idx_evaluation_sheet_archives_user_forum (user_id, forum_id, archived_at),
  FOREIGN KEY (session_id) REFERENCES evaluation_sheet_sessions(id) ON DELETE CASCADE
)
COMMENT='削除前に保存した評価シートのHTMLログ';

-- Bot口座
-- 各種購入・付与・減額ログが参照するため、初期状態で用意する
INSERT INTO accounts (user_id, user_name, wallet)
VALUES (1521705594912772227, 'LEVELIA Bot', 0)
ON DUPLICATE KEY UPDATE
  user_name = VALUES(user_name);

-- ヨーロピアンルーレット：ラウンド管理
CREATE TABLE IF NOT EXISTS roulette_rounds (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'ラウンドID',
  stage TINYINT NOT NULL COMMENT '部（1〜3）',
  status ENUM('open', 'closed', 'settled') NOT NULL DEFAULT 'open' COMMENT '受付状態',
  result_number TINYINT DEFAULT NULL COMMENT '結果（0〜36）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  closed_at TIMESTAMP DEFAULT NULL,
  settled_at TIMESTAMP DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_roulette_rounds_status (status)
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

-- 参加ボーナスの配布区切り。前回配布後から今回配布までを自動で1イベントとして扱う。
CREATE TABLE IF NOT EXISTS roulette_bonus_batches (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '配布バッチID',
  last_round_id INTEGER NOT NULL COMMENT 'この配布に含めた最後のラウンドID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roulette_bonus_batch_last_round (last_round_id),
  FOREIGN KEY (last_round_id) REFERENCES roulette_rounds(id) ON DELETE RESTRICT
)
COMMENT='ヨーロピアンルーレット参加ボーナスの配布区切り';

-- 同じ配布バッチ内での参加ボーナス二重配布を防ぐ。
CREATE TABLE IF NOT EXISTS roulette_participation_rewards (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '配布ID',
  bonus_batch_id INTEGER NOT NULL COMMENT '配布バッチID',
  user_id BIGINT NOT NULL COMMENT '参加者のDiscordユーザーID',
  amount INTEGER NOT NULL COMMENT '配布額',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roulette_bonus_batch_reward (bonus_batch_id, user_id),
  FOREIGN KEY (bonus_batch_id) REFERENCES roulette_bonus_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='ヨーロピアンルーレット参加ボーナス';

-- 市場ガチャ
CREATE TABLE IF NOT EXISTS market_gacha_draws (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '抽選ID',
  user_id BIGINT NOT NULL COMMENT '抽選したDiscordユーザーID',
  prize_key VARCHAR(64) NOT NULL COMMENT '景品識別子',
  prize_name VARCHAR(128) NOT NULL COMMENT '抽選時点の景品名',
  payment_source VARCHAR(16) NOT NULL DEFAULT 'currency' COMMENT 'currency または invite_point',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '抽選日時',
  PRIMARY KEY (id),
  KEY idx_market_gacha_draws_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='市場ガチャ抽選履歴';

CREATE TABLE IF NOT EXISTS invite_point_balances (
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  points INTEGER NOT NULL DEFAULT 0 COMMENT '現在の招待ポイント',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='招待ポイント残高';

CREATE TABLE IF NOT EXISTS invite_point_transactions (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '招待ポイント取引ID',
  user_id BIGINT NOT NULL COMMENT '対象DiscordユーザーID',
  operator_user_id BIGINT DEFAULT NULL COMMENT '付与実行者。ガチャ消費時はNULL',
  transaction_type VARCHAR(32) NOT NULL COMMENT 'grant または gacha_draw',
  amount INTEGER NOT NULL COMMENT '増減ポイント。消費は負数',
  balance_after INTEGER NOT NULL COMMENT '取引後残高',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_invite_point_transactions_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='招待ポイント付与・消費履歴';

-- おみくじ。全アカウントの一日一回制限はアプリ側で判定する。
CREATE TABLE IF NOT EXISTS omikuji_draws (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT 'おみくじ抽選ID',
  user_id BIGINT NOT NULL COMMENT '抽選したDiscordユーザーID',
  draw_date DATE NOT NULL COMMENT '日本時間の抽選日',
  fortune VARCHAR(16) NOT NULL COMMENT '小吉・中吉・大吉・凶・超大吉',
  amount INTEGER NOT NULL COMMENT '増減通貨額',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '抽選日時',
  PRIMARY KEY (id),
  KEY idx_omikuji_draws_user_date (user_id, draw_date),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='おみくじ抽選履歴';

CREATE TABLE IF NOT EXISTS market_gacha_audio_assets (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '音源ID',
  category VARCHAR(32) NOT NULL COMMENT 'superchat または song_cover',
  performer_name VARCHAR(128) NOT NULL COMMENT '演者名',
  object_key VARCHAR(512) NOT NULL COMMENT 'R2オブジェクトキー',
  file_name VARCHAR(255) NOT NULL COMMENT '元ファイル名',
  public_url VARCHAR(1024) NOT NULL COMMENT 'R2公開URL',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '抽選対象なら1',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_market_gacha_audio_assets_object_key (object_key),
  KEY idx_market_gacha_audio_assets_category_active (category, is_active)
)
COMMENT='市場ガチャで配信するR2音源';

CREATE TABLE IF NOT EXISTS market_gacha_audio_deliveries (
  draw_id INTEGER NOT NULL COMMENT '市場ガチャ抽選ID',
  audio_asset_id INTEGER NOT NULL COMMENT '配信した音源ID',
  delivered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '配信確定日時',
  PRIMARY KEY (draw_id),
  KEY idx_market_gacha_audio_deliveries_asset (audio_asset_id),
  FOREIGN KEY (draw_id) REFERENCES market_gacha_draws(id) ON DELETE CASCADE,
  FOREIGN KEY (audio_asset_id) REFERENCES market_gacha_audio_assets(id) ON DELETE RESTRICT
)
COMMENT='市場ガチャの音源配信履歴';

INSERT INTO market_gacha_audio_assets
  (category, performer_name, object_key, file_name, public_url)
VALUES
  ('superchat', '強がり', 'superchat/seikin/trim_B20B1C9A-508E-44CC-A98F-F9979DEE8CC4.mp4', 'trim_B20B1C9A-508E-44CC-A98F-F9979DEE8CC4.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/seikin/trim_B20B1C9A-508E-44CC-A98F-F9979DEE8CC4.mp4'),
  ('song_cover', '強がり', 'song-cover/seikin/My_Movie.mov', 'My_Movie.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/song-cover/seikin/My_Movie.mov'),
  ('song_cover', 'エロ感ワイド', 'song-cover/kenzoku/ScreenRecording_07-03-2026_02-49-16_1.mov', 'ScreenRecording_07-03-2026_02-49-16_1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/song-cover/kenzoku/ScreenRecording_07-03-2026_02-49-16_1.mov'),
  ('superchat', 'エロ感ワイド', 'superchat/kenzoku/ScreenRecording_02-26-2026_21-40-47_1-1.mov', 'ScreenRecording_02-26-2026_21-40-47_1-1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kenzoku/ScreenRecording_02-26-2026_21-40-47_1-1.mov'),
  ('superchat', 'killer対象外', 'superchat/zanki/4271EDAB-88CF-4C6E-B32C-D6948422CA80-1.mov', '4271EDAB-88CF-4C6E-B32C-D6948422CA80-1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/zanki/4271EDAB-88CF-4C6E-B32C-D6948422CA80-1.mov'),
  ('superchat', 'killer対象外', 'superchat/zanki/copy_C7A0EC8D-35D0-4E6F-BE82-40DB38458B6B.mov', 'copy_C7A0EC8D-35D0-4E6F-BE82-40DB38458B6B.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/zanki/copy_C7A0EC8D-35D0-4E6F-BE82-40DB38458B6B.mov')
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  performer_name = VALUES(performer_name),
  file_name = VALUES(file_name),
  public_url = VALUES(public_url);

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
