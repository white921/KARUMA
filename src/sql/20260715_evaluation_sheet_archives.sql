-- 既存KARUMA DB向け: 評価シートの保存・削除・復元機能
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
