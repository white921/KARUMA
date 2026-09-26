-- 2026-09-26受領の朱桜のサプボ2本目を追加する。
-- R2への配置後に適用する。再実行しても同じ音源を更新する。
INSERT INTO market_gacha_audio_assets
  (category, performer_name, performer_user_id, object_key, file_name, public_url, is_active)
VALUES
  ('superchat', '朱桜', 1508435688218169457, 'superchat/1508435688218169457/ScreenRecording_09-26-2026_21-25-40_1.mov', 'ScreenRecording_09-26-2026 21-25-40_1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/1508435688218169457/ScreenRecording_09-26-2026_21-25-40_1.mov', 1)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  performer_name = VALUES(performer_name),
  performer_user_id = VALUES(performer_user_id),
  file_name = VALUES(file_name),
  public_url = VALUES(public_url),
  is_active = VALUES(is_active);
