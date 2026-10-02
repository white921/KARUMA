CREATE TABLE IF NOT EXISTS competition_entry_profiles (
  user_id BIGINT NOT NULL COMMENT '回答者のDiscordユーザーID',
  display_name VARCHAR(64) NOT NULL COMMENT '回答時点のサーバー表示名',
  team_key ENUM('red', 'blue') NOT NULL COMMENT '回答者の所属チーム',
  day1_availability ENUM('available', 'conditional', 'unavailable') NOT NULL COMMENT '1日目の参加可否',
  day2_availability ENUM('available', 'conditional', 'unavailable') NOT NULL COMMENT '2日目の参加可否',
  day3_availability ENUM('available', 'conditional', 'unavailable') NOT NULL COMMENT '3日目の参加可否',
  overall_notes VARCHAR(500) DEFAULT NULL COMMENT '日程などに関する全体備考',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_competition_entry_profiles_team (team_key),
  KEY idx_competition_entry_profiles_updated_at (updated_at)
)
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='双璧戦エントリーの日程回答と全体備考';
