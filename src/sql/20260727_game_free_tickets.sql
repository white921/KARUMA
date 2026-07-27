CREATE TABLE IF NOT EXISTS game_free_tickets (
  user_id BIGINT NOT NULL COMMENT 'DiscordユーザーID',
  ticket_type VARCHAR(16) NOT NULL COMMENT 'SHORT（6時間プラン用）',
  quantity INTEGER NOT NULL DEFAULT 0 COMMENT '所持枚数',
  PRIMARY KEY (user_id, ticket_type),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='遊戯チケット';
