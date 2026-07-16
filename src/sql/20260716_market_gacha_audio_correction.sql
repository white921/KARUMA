-- 教祖の当該ファイルはサプボではなく歌みたとして抽選する。
UPDATE market_gacha_audio_assets
SET category = 'song_cover'
WHERE public_url = 'https://pub-aaabd7254d424bdba4911fc1e40251e9.r2.dev/superchat/kyoso/YouCut_20260622_135046734.mp4'
  AND category <> 'song_cover';
