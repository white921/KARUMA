-- 遊戯チケットの用途を、旧6時間プランから12時間の遊戯VC作成へ更新する。
-- item_key は維持するため、既存の所持数はそのまま引き継がれる。
UPDATE items
SET name = '遊戯チケット',
    description = '遊戯VCを1部屋（12時間）無料で作成できる券'
WHERE item_key = 'GAME_SHORT_FREE';
