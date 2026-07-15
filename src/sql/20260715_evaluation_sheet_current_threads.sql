-- 既存評価シートDB向け: user_id単位で現在のスレッドIDを更新する管理テーブル
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

-- すでに作成済みの有効な評価シートがある場合は、現在スレッドとして引き継ぐ。
INSERT INTO evaluation_sheet_current_threads
  (user_id, forum_id, thread_id, session_id, status)
SELECT session.user_id, thread.forum_id, thread.thread_id, session.id, 'active'
FROM evaluation_sheet_sessions session
INNER JOIN evaluation_sheet_threads thread ON thread.session_id = session.id
WHERE session.status IN ('active', 'saved')
ON DUPLICATE KEY UPDATE
  thread_id = VALUES(thread_id),
  session_id = VALUES(session_id),
  status = 'active',
  updated_at = CURRENT_TIMESTAMP;
