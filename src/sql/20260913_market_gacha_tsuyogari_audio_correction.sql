-- 強がりの9月追加分2本について、ユーザー確認済みの内容に合わせて分類を修正する。
-- 配信済みURLと履歴を維持するため、R2キー・URL・音源IDは変更しない。
-- 分類を明示的に指定し、再実行しても逆戻りしないようにする。
UPDATE market_gacha_audio_assets
SET category = CASE object_key
  WHEN 'superchat/seikin/ScreenRecording_11-28-2025_23-14-12_1.mov' THEN 'song_cover'
  WHEN 'song-cover/seikin/copy_E1CE7C12-66B3-40D5-8DE0-EE6B4A1B5FB3.mov' THEN 'superchat'
END
WHERE performer_user_id = 1223107953444257812
  AND object_key IN (
    'superchat/seikin/ScreenRecording_11-28-2025_23-14-12_1.mov',
    'song-cover/seikin/copy_E1CE7C12-66B3-40D5-8DE0-EE6B4A1B5FB3.mov'
  );
