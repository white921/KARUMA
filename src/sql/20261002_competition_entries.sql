CREATE TABLE IF NOT EXISTS competition_entries (
  user_id BIGINT NOT NULL COMMENT '回答者のDiscordユーザーID',
  display_name VARCHAR(64) NOT NULL COMMENT '回答時点のサーバー表示名',
  team_key ENUM('red', 'blue') NOT NULL COMMENT '回答者の所属チーム',
  discipline VARCHAR(32) NOT NULL COMMENT '競技識別子',
  availability ENUM('available', 'conditional', 'unavailable') NOT NULL COMMENT '出場可否',
  rank_name VARCHAR(64) DEFAULT NULL COMMENT 'ランクまたは雀魂段位',
  game_name VARCHAR(64) DEFAULT NULL COMMENT 'ゲーム内ネームまたは競技固有情報',
  game_id VARCHAR(100) DEFAULT NULL COMMENT 'ゲーム内ID',
  notes VARCHAR(200) DEFAULT NULL COMMENT '備考',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, discipline),
  KEY idx_competition_entries_team_discipline (team_key, discipline),
  KEY idx_competition_entries_updated_at (updated_at)
)
COMMENT='双璧戦の競技別出場アンケート回答';
