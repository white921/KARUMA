-- 2026-10-14受領の10本を添付順で追加する（全件サプボ、1本は夏&朱桜の共同音源）。
-- R2への配置後に適用する。再実行しても同じ音源を更新する。
SET @has_performer_user_ids := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'market_gacha_audio_assets'
    AND column_name = 'performer_user_ids'
);
SET @add_performer_user_ids_sql := IF(
  @has_performer_user_ids = 0,
  'ALTER TABLE market_gacha_audio_assets ADD COLUMN performer_user_ids JSON DEFAULT NULL COMMENT ''共同音源を含む演者のDiscordユーザーID一覧'' AFTER performer_user_id',
  'SELECT 1'
);
PREPARE add_performer_user_ids_statement FROM @add_performer_user_ids_sql;
EXECUTE add_performer_user_ids_statement;
DEALLOCATE PREPARE add_performer_user_ids_statement;

INSERT INTO market_gacha_audio_assets
  (category, performer_name, performer_user_id, performer_user_ids, object_key, file_name, public_url, is_active)
VALUES
  ('superchat', 'ねてたい', 1185245764729974824, JSON_ARRAY('1185245764729974824'), 'superchat/1185245764729974824/copy_EEC373CD-E256-49FB-A0BC-72EE330A7AE9.mov', 'copy_EEC373CD-E256-49FB-A0BC-72EE330A7AE9.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/1185245764729974824/copy_EEC373CD-E256-49FB-A0BC-72EE330A7AE9.mov', 1),
  ('superchat', 'ぽっぴん', 1181197385217605643, JSON_ARRAY('1181197385217605643'), 'superchat/1181197385217605643/copy_801A1B01-25B9-4B5B-BC5E-B95CC8F9385C.mov', 'copy_801A1B01-25B9-4B5B-BC5E-B95CC8F9385C.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/1181197385217605643/copy_801A1B01-25B9-4B5B-BC5E-B95CC8F9385C.mov', 1),
  ('superchat', '夏', 1363509186461176121, JSON_ARRAY('1363509186461176121'), 'superchat/1363509186461176121/copy_979E78B8-C889-4BE8-812C-47531532A7A1.mov', 'copy_979E78B8-C889-4BE8-812C-47531532A7A1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/1363509186461176121/copy_979E78B8-C889-4BE8-812C-47531532A7A1.mov', 1),
  ('superchat', 'killer対象外', 1508895495873888452, JSON_ARRAY('1508895495873888452'), 'superchat/1508895495873888452/copy_80E6BE63-C88A-4929-AD60-FBBAD4ADBE34.mp4', 'copy_80E6BE63-C88A-4929-AD60-FBBAD4ADBE34.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/1508895495873888452/copy_80E6BE63-C88A-4929-AD60-FBBAD4ADBE34.mp4', 1),
  ('superchat', 'てこてこ戦士', 1463545283861549211, JSON_ARRAY('1463545283861549211'), 'superchat/1463545283861549211/copy_F017FBB1-88A5-4ABE-A4D3-EE88791FE8AF.mp4', 'copy_F017FBB1-88A5-4ABE-A4D3-EE88791FE8AF.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/1463545283861549211/copy_F017FBB1-88A5-4ABE-A4D3-EE88791FE8AF.mp4', 1),
  ('superchat', '夏&朱桜', 1363509186461176121, JSON_ARRAY('1363509186461176121', '1508435688218169457'), 'superchat/1363509186461176121-1508435688218169457/copy_93BABFE4-7B23-45B1-B665-735AD88E5342_1_.mov', 'copy_93BABFE4-7B23-45B1-B665-735AD88E5342 (1).mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/1363509186461176121-1508435688218169457/copy_93BABFE4-7B23-45B1-B665-735AD88E5342_1_.mov', 1),
  ('superchat', '帰蝶', 1514136712048279587, JSON_ARRAY('1514136712048279587'), 'superchat/1514136712048279587/1B821E77-AFAD-4926-AE8E-D3F878D53281.mp4', '1B821E77-AFAD-4926-AE8E-D3F878D53281.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/1514136712048279587/1B821E77-AFAD-4926-AE8E-D3F878D53281.mp4', 1),
  ('superchat', 'ゑ戸川', 1290939535160639510, JSON_ARRAY('1290939535160639510'), 'superchat/1290939535160639510/copy_08D5FAB2-3535-45BC-9230-4BF4A2A15A68.mov', 'copy_08D5FAB2-3535-45BC-9230-4BF4A2A15A68.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/1290939535160639510/copy_08D5FAB2-3535-45BC-9230-4BF4A2A15A68.mov', 1),
  ('superchat', 'ゑ戸川', 1290939535160639510, JSON_ARRAY('1290939535160639510'), 'superchat/1290939535160639510/copy_91D3F10B-C8CD-476A-BD5D-5612D8F680B2.mov', 'copy_91D3F10B-C8CD-476A-BD5D-5612D8F680B2.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/1290939535160639510/copy_91D3F10B-C8CD-476A-BD5D-5612D8F680B2.mov', 1),
  ('superchat', '有栖', 783666705967742986, JSON_ARRAY('783666705967742986'), 'superchat/783666705967742986/1014_1_.mp4', '1014(1).mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/783666705967742986/1014_1_.mp4', 1)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  performer_name = VALUES(performer_name),
  performer_user_id = VALUES(performer_user_id),
  performer_user_ids = VALUES(performer_user_ids),
  file_name = VALUES(file_name),
  public_url = VALUES(public_url),
  is_active = VALUES(is_active);
