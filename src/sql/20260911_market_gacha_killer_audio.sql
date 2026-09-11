-- killer対象外のサプボ2本を市場ガチャの抽選対象へ追加する。
-- R2オブジェクトを配置した後に適用する。再実行時も同じ行を更新する。
INSERT INTO market_gacha_audio_assets
  (category, performer_name, performer_user_id, object_key, file_name, public_url, is_active)
VALUES
  ('superchat', 'killer対象外', 1508895495873888452, 'superchat/zanki/copy_80244846-E547-42A0-A59C-9A47368F4D28.mp4', 'copy_80244846-E547-42A0-A59C-9A47368F4D28.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/zanki/copy_80244846-E547-42A0-A59C-9A47368F4D28.mp4', 1),
  ('superchat', 'killer対象外', 1508895495873888452, 'superchat/zanki/copy_2B126E6F-2FCB-4AE7-846C-F647A4C5B2BF.mov', 'copy_2B126E6F-2FCB-4AE7-846C-F647A4C5B2BF.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/zanki/copy_2B126E6F-2FCB-4AE7-846C-F647A4C5B2BF.mov', 1)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  performer_name = VALUES(performer_name),
  performer_user_id = VALUES(performer_user_id),
  file_name = VALUES(file_name),
  public_url = VALUES(public_url),
  is_active = VALUES(is_active);
