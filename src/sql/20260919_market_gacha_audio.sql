-- 2026-09-19受領の5本を添付順で追加する（サプボ3本・歌みた2本）。
-- R2への配置後に適用する。再実行しても同じ音源を更新する。
INSERT INTO market_gacha_audio_assets
  (category, performer_name, performer_user_id, object_key, file_name, public_url, is_active)
VALUES
  ('superchat', 'killer対象外', 1508895495873888452, 'superchat/zanki/copy_4CD02FDC-CAB8-4AD3-9900-3AAC1FC35B9B.mov', 'copy_4CD02FDC-CAB8-4AD3-9900-3AAC1FC35B9B.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/zanki/copy_4CD02FDC-CAB8-4AD3-9900-3AAC1FC35B9B.mov', 1),
  ('song_cover', 'エロ感ワイド', 1536218537696165949, 'song-cover/kenzoku/v14044g50000d8ls6b7og65mfs426v20.mov', 'v14044g50000d8ls6b7og65mfs426v20.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/song-cover/kenzoku/v14044g50000d8ls6b7og65mfs426v20.mov', 1),
  ('superchat', '僕は気ままなゴミムシでしゅ', 1229603188068323348, 'superchat/kimamana-gomimushi/ScreenRecording_09-14-2026_00-57-20_1.mov', 'ScreenRecording_09-14-2026 00-57-20_1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kimamana-gomimushi/ScreenRecording_09-14-2026_00-57-20_1.mov', 1),
  ('song_cover', 'ぽっぴん', 1181197385217605643, 'song-cover/poppin/copy_25DD1020-3B40-47F9-850A-5288A7E0AF5A.mov', 'copy_25DD1020-3B40-47F9-850A-5288A7E0AF5A.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/song-cover/poppin/copy_25DD1020-3B40-47F9-850A-5288A7E0AF5A.mov', 1),
  ('superchat', '僕は気ままなゴミムシでしゅ', 1229603188068323348, 'superchat/kimamana-gomimushi/ScreenRecording_09-19-2026_16-40-20_1.mov', 'ScreenRecording_09-19-2026 16-40-20_1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kimamana-gomimushi/ScreenRecording_09-19-2026_16-40-20_1.mov', 1)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  performer_name = VALUES(performer_name),
  performer_user_id = VALUES(performer_user_id),
  file_name = VALUES(file_name),
  public_url = VALUES(public_url),
  is_active = VALUES(is_active);
