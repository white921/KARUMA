-- 既存の時間数を保持したまま30分（0.5時間）単位に対応。再実行可能。
ALTER TABLE cast_payments MODIFY COLUMN hours DECIMAL(11,1) NOT NULL;
