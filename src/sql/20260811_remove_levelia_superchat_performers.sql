-- LEVELIAでは指定された5名のサプボを抽選対象から外す。
-- 配信履歴の外部キーを保持するため、行は削除せず無効化する。
UPDATE market_gacha_audio_assets
SET is_active = 0
WHERE category = 'superchat'
  AND performer_name IN ('ちゃま', '牧師', '救済', '七転勃起', '遅漏でなさ候');
