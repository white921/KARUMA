-- 期限自体はDiscordから取得する。このテーブルは日次通知の再送防止用。
CREATE TABLE IF NOT EXISTS evaluation_deadline_reminders (
  guild_id VARCHAR(20) NOT NULL,
  notice_date DATE NOT NULL COMMENT '日本時間の通知日',
  pages JSON NOT NULL COMMENT '送信開始時点で確定した通知本文とメンション対象',
  message_ids JSON NOT NULL COMMENT '各ページの送信済みDiscordメッセージID',
  completed TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, notice_date)
) ENGINE=InnoDB COMMENT='評価期限の日次通知と再起動時の重複防止';
