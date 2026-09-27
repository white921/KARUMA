-- Discordのメンバーキャッシュに依存せず退出処理を行うため、最後に確認できた在籍状態を保存する。
-- 既存の退出者は自動補正しない。デプロイ後に在籍を確認できた口座だけが起動時照合の対象になる。
CREATE TABLE IF NOT EXISTS account_membership_states (
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  is_present BOOLEAN NOT NULL DEFAULT TRUE COMMENT '最後に確認できたサーバー在籍状態',
  joined_at DATETIME(3) DEFAULT NULL COMMENT '現在または最後に確認した参加日時',
  display_name VARCHAR(64) DEFAULT NULL COMMENT '最後に確認したサーバー表示名',
  core_member_role_id BIGINT DEFAULT NULL COMMENT '最後に確認した復元対象の基本ロール',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (user_id),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='Discord在籍状態と退出時フォールバック情報';
