-- 月間売上で通常の遊戯VC作成と罪人用VC作成を分ける。
-- 旧ログでは両方が game_vc_create だったが、罪人料金の10,000 LIAは
-- 通常料金（0 / 5,000 / 6,000 LIA）と重複しないため識別できる。
UPDATE actions
SET command_name = 'game_criminal_vc_create'
WHERE command_name = 'game_vc_create'
  AND amount = 10000;
