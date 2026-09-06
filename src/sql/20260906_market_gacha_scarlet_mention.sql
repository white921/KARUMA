-- 既存DBの歌みた音源をScarletへ紐付け直す。
-- 対象のR2オブジェクトキーに限定しているため、同名の別音源は変更しない。
UPDATE market_gacha_audio_assets
SET performer_user_id = 1086598017345388685
WHERE category = 'song_cover'
  AND object_key = 'song-cover/secret/2c3bb35d17d4eb67c0338ca3e173bd89.mp4';
