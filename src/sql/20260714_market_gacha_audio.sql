-- 市場ガチャのサプボ・歌みた。R2の公開URLと、どの抽選で配信したかを保存する。
CREATE TABLE IF NOT EXISTS market_gacha_audio_assets (
  id INTEGER NOT NULL AUTO_INCREMENT COMMENT '音源ID',
  category VARCHAR(32) NOT NULL COMMENT 'superchat または song_cover',
  performer_name VARCHAR(128) NOT NULL COMMENT '演者名',
  object_key VARCHAR(512) NOT NULL COMMENT 'R2オブジェクトキー',
  file_name VARCHAR(255) NOT NULL COMMENT '元ファイル名',
  public_url VARCHAR(1024) NOT NULL COMMENT 'R2公開URL',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '抽選対象なら1',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_market_gacha_audio_assets_object_key (object_key),
  KEY idx_market_gacha_audio_assets_category_active (category, is_active)
)
COMMENT='市場ガチャで配信するR2音源';

CREATE TABLE IF NOT EXISTS market_gacha_audio_deliveries (
  draw_id INTEGER NOT NULL COMMENT '市場ガチャ抽選ID',
  audio_asset_id INTEGER NOT NULL COMMENT '配信した音源ID',
  delivered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '配信確定日時',
  PRIMARY KEY (draw_id),
  KEY idx_market_gacha_audio_deliveries_asset (audio_asset_id),
  FOREIGN KEY (draw_id) REFERENCES market_gacha_draws(id) ON DELETE CASCADE,
  FOREIGN KEY (audio_asset_id) REFERENCES market_gacha_audio_assets(id) ON DELETE RESTRICT
)
COMMENT='市場ガチャの音源配信履歴';

INSERT INTO market_gacha_audio_assets
  (category, performer_name, object_key, file_name, public_url)
VALUES
  ('superchat', '教祖', 'superchat/kyoso/YouCut_20260628_114125860.mp4', 'YouCut_20260628_114125860.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kyoso/YouCut_20260628_114125860.mp4'),
  ('song_cover', '教祖', 'superchat/kyoso/YouCut_20260622_135046734.mp4', 'YouCut_20260622_135046734.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kyoso/YouCut_20260622_135046734.mp4'),
  ('superchat', '教祖', 'superchat/kyoso/YouCut_20260604_204843312.mp4', 'YouCut_20260604_204843312.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kyoso/YouCut_20260604_204843312.mp4'),
  ('song_cover', '教祖', 'song-cover/kyoso/YouCut_20260529_203035054.mp4', 'YouCut_20260529_203035054.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/song-cover/kyoso/YouCut_20260529_203035054.mp4'),
  ('superchat', '聖金', 'superchat/seikin/trim_B20B1C9A-508E-44CC-A98F-F9979DEE8CC4.mp4', 'trim_B20B1C9A-508E-44CC-A98F-F9979DEE8CC4.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/seikin/trim_B20B1C9A-508E-44CC-A98F-F9979DEE8CC4.mp4'),
  ('song_cover', '聖金', 'song-cover/seikin/My_Movie.mov', 'My_Movie.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/song-cover/seikin/My_Movie.mov'),
  ('song_cover', '眷属', 'song-cover/kenzoku/ScreenRecording_07-03-2026_02-49-16_1.mov', 'ScreenRecording_07-03-2026_02-49-16_1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/song-cover/kenzoku/ScreenRecording_07-03-2026_02-49-16_1.mov'),
  ('superchat', '眷属', 'superchat/kenzoku/ScreenRecording_02-26-2026_21-40-47_1-1.mov', 'ScreenRecording_02-26-2026_21-40-47_1-1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kenzoku/ScreenRecording_02-26-2026_21-40-47_1-1.mov'),
  ('superchat', '遅漏でなさ候', 'superchat/chiro-denasakou/copy_25BF0B02-0739-4A80-ACE6-157F7053F277.mp4', 'copy_25BF0B02-0739-4A80-ACE6-157F7053F277.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/chiro-denasakou/copy_25BF0B02-0739-4A80-ACE6-157F7053F277.mp4'),
  ('superchat', '遅漏でなさ候', 'superchat/chiro-denasakou/copy_148FC1AF-0128-4B8B-80F4-4F15D327DA53.mov', 'copy_148FC1AF-0128-4B8B-80F4-4F15D327DA53.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/chiro-denasakou/copy_148FC1AF-0128-4B8B-80F4-4F15D327DA53.mov'),
  ('superchat', 'ちゃま', 'superchat/chama/copy_72826FA3-7E38-4B1B-8101-2DC9D1F77B7C.mp4', 'copy_72826FA3-7E38-4B1B-8101-2DC9D1F77B7C.mp4', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/chama/copy_72826FA3-7E38-4B1B-8101-2DC9D1F77B7C.mp4'),
  ('superchat', 'ちゃま', 'superchat/chama/copy_0F46C460-1FFD-4A06-91A0-B837B43FDB64.mov', 'copy_0F46C460-1FFD-4A06-91A0-B837B43FDB64.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/chama/copy_0F46C460-1FFD-4A06-91A0-B837B43FDB64.mov'),
  ('superchat', '慚愧', 'superchat/zanki/4271EDAB-88CF-4C6E-B32C-D6948422CA80-1.mov', '4271EDAB-88CF-4C6E-B32C-D6948422CA80-1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/zanki/4271EDAB-88CF-4C6E-B32C-D6948422CA80-1.mov'),
  ('superchat', '慚愧', 'superchat/zanki/copy_C7A0EC8D-35D0-4E6F-BE82-40DB38458B6B.mov', 'copy_C7A0EC8D-35D0-4E6F-BE82-40DB38458B6B.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/zanki/copy_C7A0EC8D-35D0-4E6F-BE82-40DB38458B6B.mov'),
  ('superchat', '炎武零夢', 'superchat/enbu-reimu/copy_A60A1133-8C38-4E49-814A-B5C0CFC3AB70.mov', 'copy_A60A1133-8C38-4E49-814A-B5C0CFC3AB70.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/enbu-reimu/copy_A60A1133-8C38-4E49-814A-B5C0CFC3AB70.mov'),
  ('superchat', '救済', 'superchat/kyusai/copy_75008088-3F97-4F4D-9FA8-2EA97F9B0FDD.mov', 'copy_75008088-3F97-4F4D-9FA8-2EA97F9B0FDD.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kyusai/copy_75008088-3F97-4F4D-9FA8-2EA97F9B0FDD.mov'),
  ('superchat', '救済', 'superchat/kyusai/copy_DE71B7AB-53E8-4494-89BF-C924F461E274.mov', 'copy_DE71B7AB-53E8-4494-89BF-C924F461E274.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kyusai/copy_DE71B7AB-53E8-4494-89BF-C924F461E274.mov'),
  ('superchat', '牧師', 'superchat/bokushi/a5695d55b8f445fa929532c5f6dddb93-1.mov', 'a5695d55b8f445fa929532c5f6dddb93-1.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/bokushi/a5695d55b8f445fa929532c5f6dddb93-1.mov'),
  ('superchat', '七転勃起', 'superchat/nanakorobi-bokki/copy_93640CA2-560D-4925-A978-780AE9A14A93.mov', 'copy_93640CA2-560D-4925-A978-780AE9A14A93.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/nanakorobi-bokki/copy_93640CA2-560D-4925-A978-780AE9A14A93.mov'),
  ('superchat', '七転勃起', 'superchat/nanakorobi-bokki/copy_072CBAC9-CA78-458F-BA24-552C6393F7B3.mov', 'copy_072CBAC9-CA78-458F-BA24-552C6393F7B3.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/nanakorobi-bokki/copy_072CBAC9-CA78-458F-BA24-552C6393F7B3.mov'),
  ('superchat', 'Mtc-S3RL', 'superchat/mtc-s3rl/copy_1AD999D0-9B09-4E30-802E-EC62138E04DE.mov', 'copy_1AD999D0-9B09-4E30-802E-EC62138E04DE.mov', 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/mtc-s3rl/copy_1AD999D0-9B09-4E30-802E-EC62138E04DE.mov')
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  performer_name = VALUES(performer_name),
  file_name = VALUES(file_name),
  public_url = VALUES(public_url);
