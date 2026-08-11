-- LEVELIA移転後の利用者向け名称を既存DBへ反映する。
UPDATE accounts
SET user_name = 'LEVELIA Bot'
WHERE user_id = 1521705594912772227;

UPDATE items
SET name = '市場割引券 5%OFF',
    description = '100万LIA未満の市場支払いに使える5%割引券'
WHERE item_key = 'SHOP_DISCOUNT_5';

UPDATE items
SET name = '市場割引券 10%OFF',
    description = '100万LIA未満の市場支払いに使える10%割引券'
WHERE item_key = 'SHOP_DISCOUNT_10';

UPDATE items
SET description = '遊戯の6時間プランを無料で利用できる券'
WHERE item_key = 'GAME_SHORT_FREE';
