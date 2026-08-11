-- LEVELIAの現行演者に合わせて、削除対象を無効化し表示名を更新する。
-- 配信履歴の外部キーを保持するため、削除対象の行自体は残す。
UPDATE market_gacha_audio_assets
SET is_active = 0
WHERE performer_name IN ('Mtc-S3RL', '炎武零夢', '教祖');

UPDATE market_gacha_audio_assets
SET performer_name = CASE performer_name
  WHEN '聖金' THEN '強がり'
  WHEN '眷属' THEN 'エロ感ワイド'
  WHEN '慚愧' THEN 'killer対象外'
  ELSE performer_name
END
WHERE performer_name IN ('聖金', '眷属', '慚愧');
