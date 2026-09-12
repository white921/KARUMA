-- 天与呪縛・killer対象外・夏のサプボを各1本、市場ガチャの抽選対象へ追加する。
-- R2オブジェクトを配置した後に適用する。再実行時も同じ行を更新する。
INSERT INTO market_gacha_audio_assets
  (category, performer_name, performer_user_id, object_key, file_name, public_url, is_active)
VALUES
  ('superchat', '天与呪縛', 1256656484838932563, 'superchat/tenyo-jubaku/copy_66312C16-481F-4312-95B0-E38C06649B0A.mov', 'copy_66312C16-481F-4312-95B0-E38C06649B0A.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/tenyo-jubaku/copy_66312C16-481F-4312-95B0-E38C06649B0A.mov', 1),
  ('superchat', 'killer対象外', 1508895495873888452, 'superchat/zanki/copy_BC27E94F-FC41-4A10-BBB1-0F17A71ED2BD.mov', 'copy_BC27E94F-FC41-4A10-BBB1-0F17A71ED2BD.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/zanki/copy_BC27E94F-FC41-4A10-BBB1-0F17A71ED2BD.mov', 1),
  ('superchat', '夏', 1363509186461176121, 'superchat/natsu/copy_B8F8FC93-6EAD-4DE2-BDF5-76F0C4C7B65A.mov', 'copy_B8F8FC93-6EAD-4DE2-BDF5-76F0C4C7B65A.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/natsu/copy_B8F8FC93-6EAD-4DE2-BDF5-76F0C4C7B65A.mov', 1)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  performer_name = VALUES(performer_name),
  performer_user_id = VALUES(performer_user_id),
  file_name = VALUES(file_name),
  public_url = VALUES(public_url),
  is_active = VALUES(is_active);
