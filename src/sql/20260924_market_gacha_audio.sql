-- 2026-09-24受領の5本を添付順で追加する（全件サプボ）。
-- R2への配置後に適用する。再実行しても同じ音源を更新する。
INSERT INTO market_gacha_audio_assets
  (category, performer_name, performer_user_id, object_key, file_name, public_url, is_active)
VALUES
  ('superchat', 'にゃさん', 657269973848162384, 'superchat/nya-san/9F302217-0478-494A-8EC2-7AA66CD947CC.mp4', '9F302217-0478-494A-8EC2-7AA66CD947CC.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/nya-san/9F302217-0478-494A-8EC2-7AA66CD947CC.mp4', 1),
  ('superchat', '流川', 918705763948593152, 'superchat/rukawa/D7807C99-EA6E-4E08-A403-726B1C230A64.mov', 'D7807C99-EA6E-4E08-A403-726B1C230A64.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/rukawa/D7807C99-EA6E-4E08-A403-726B1C230A64.mov', 1),
  ('superchat', '僕は気ままなゴミムシでしゅ', 1229603188068323348, 'superchat/kimamana-gomimushi/copy_1AE81E4E-C056-4973-AFE6-FDBE34689621.mov', 'copy_1AE81E4E-C056-4973-AFE6-FDBE34689621.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kimamana-gomimushi/copy_1AE81E4E-C056-4973-AFE6-FDBE34689621.mov', 1),
  ('superchat', 'なかの', 952187384236220496, 'superchat/nakano/copy_48D81CA1-D7BC-46E0-AD25-0AD9696C3679.mov', 'copy_48D81CA1-D7BC-46E0-AD25-0AD9696C3679.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/nakano/copy_48D81CA1-D7BC-46E0-AD25-0AD9696C3679.mov', 1),
  ('superchat', '強がり', 1223107953444257812, 'superchat/seikin/copy_253559B9-3031-49F0-B03A-33AEB10FFB10.mov', 'copy_253559B9-3031-49F0-B03A-33AEB10FFB10.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/seikin/copy_253559B9-3031-49F0-B03A-33AEB10FFB10.mov', 1)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  performer_name = VALUES(performer_name),
  performer_user_id = VALUES(performer_user_id),
  file_name = VALUES(file_name),
  public_url = VALUES(public_url),
  is_active = VALUES(is_active);
