ALTER TABLE competition_entries
  MODIFY COLUMN team_key ENUM('red', 'blue', 'management') NOT NULL
  COMMENT '回答者の所属チームまたは運営確認';

ALTER TABLE competition_entry_profiles
  MODIFY COLUMN team_key ENUM('red', 'blue', 'management') NOT NULL
  COMMENT '回答者の所属チームまたは運営確認';
