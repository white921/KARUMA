-- 市場ガチャの景品更新: 音源ごとの演者メンション、1日休み、遊戯チケット24時間化。
-- 再実行可能に、既存列の有無を確認してから追加する。
SET @has_performer_user_id := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'market_gacha_audio_assets'
    AND column_name = 'performer_user_id'
);
SET @add_performer_user_id_sql := IF(
  @has_performer_user_id = 0,
  'ALTER TABLE market_gacha_audio_assets ADD COLUMN performer_user_id BIGINT DEFAULT NULL COMMENT ''演者のDiscordユーザーID'' AFTER performer_name',
  'SELECT 1'
);
PREPARE add_performer_user_id_statement FROM @add_performer_user_id_sql;
EXECUTE add_performer_user_id_statement;
DEALLOCATE PREPARE add_performer_user_id_statement;

CREATE TABLE IF NOT EXISTS market_gacha_daily_locks (
  user_id BIGINT NOT NULL COMMENT '1日休みを引いたDiscordユーザーID',
  lock_date DATE NOT NULL COMMENT '日本時間の対象日',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'ロック日時',
  PRIMARY KEY (user_id, lock_date),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
)
COMMENT='市場ガチャの1日休みロック';

UPDATE market_gacha_audio_assets
SET performer_user_id = CASE performer_name
  WHEN '強がり' THEN 1223107953444257812
  WHEN 'エロ感ワイド' THEN 1536218537696165949
  WHEN 'killer対象外' THEN 1508895495873888452
  ELSE performer_user_id
END
WHERE performer_name IN ('強がり', 'エロ感ワイド', 'killer対象外');

UPDATE items
SET description = '遊戯VCを1部屋（24時間）無料で作成できる券'
WHERE item_key = 'GAME_SHORT_FREE';

INSERT INTO market_gacha_audio_assets
  (category, performer_name, performer_user_id, object_key, file_name, public_url, is_active)
VALUES
  ('song_cover', 'secret', 1074608247463493715, 'song-cover/secret/2c3bb35d17d4eb67c0338ca3e173bd89.mp4', '2c3bb35d17d4eb67c0338ca3e173bd89.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/song-cover/secret/2c3bb35d17d4eb67c0338ca3e173bd89.mp4', 1),
  ('song_cover', 'フェルミ研究所', 1091698540088139788, 'song-cover/fermi-research-institute/ScreenRecording_08-12-2026_19-52-22_1.mov', 'ScreenRecording_08-12-2026_19-52-22_1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/song-cover/fermi-research-institute/ScreenRecording_08-12-2026_19-52-22_1.mov', 1),
  ('superchat', '君の愛BOY', 1179423319250964492, 'superchat/kimi-no-ai-boy/copy_176E00E6-F1E6-49DC-B08C-30336EF1A99A-1.mov', 'copy_176E00E6-F1E6-49DC-B08C-30336EF1A99A-1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kimi-no-ai-boy/copy_176E00E6-F1E6-49DC-B08C-30336EF1A99A-1.mov', 1),
  ('superchat', '100円娯楽', 1131832710097293342, 'superchat/100-yen-goraku/2B9298D8-C1F7-46B7-8712-F2E6CFCD9291.mov', '2B9298D8-C1F7-46B7-8712-F2E6CFCD9291.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/100-yen-goraku/2B9298D8-C1F7-46B7-8712-F2E6CFCD9291.mov', 1),
  ('superchat', '夏', 1363509186461176121, 'superchat/natsu/copy_9511E1BF-C787-456A-8AD5-C99A4CBD888F.mov', 'copy_9511E1BF-C787-456A-8AD5-C99A4CBD888F.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/natsu/copy_9511E1BF-C787-456A-8AD5-C99A4CBD888F.mov', 1),
  ('superchat', '夏', 1363509186461176121, 'superchat/natsu/copy_BB847ACA-73BB-4CAE-A733-6BA1459ADDF3.mov', 'copy_BB847ACA-73BB-4CAE-A733-6BA1459ADDF3.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/natsu/copy_BB847ACA-73BB-4CAE-A733-6BA1459ADDF3.mov', 1),
  ('song_cover', '強がり', 1223107953444257812, 'song-cover/seikin/copy_E1CE7C12-66B3-40D5-8DE0-EE6B4A1B5FB3.mov', 'copy_E1CE7C12-66B3-40D5-8DE0-EE6B4A1B5FB3.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/song-cover/seikin/copy_E1CE7C12-66B3-40D5-8DE0-EE6B4A1B5FB3.mov', 1),
  ('superchat', '強がり', 1223107953444257812, 'superchat/seikin/ScreenRecording_11-28-2025_23-14-12_1.mov', 'ScreenRecording_11-28-2025 23-14-12_1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/seikin/ScreenRecording_11-28-2025_23-14-12_1.mov', 1)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  performer_name = VALUES(performer_name),
  performer_user_id = VALUES(performer_user_id),
  file_name = VALUES(file_name),
  public_url = VALUES(public_url),
  is_active = VALUES(is_active);
