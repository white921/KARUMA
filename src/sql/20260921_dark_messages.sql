-- 支払い確認は運営が既存の闇市場購入ログで実施。1パネルにつき1通。
-- 送信元と配送先は将来の開示用に保持し、公開TCには送信元を載せない。
CREATE TABLE IF NOT EXISTS dark_message_requests (
  request_id VARCHAR(20) NOT NULL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  source_channel_id VARCHAR(20) NOT NULL,
  buyer_id VARCHAR(20) NOT NULL,
  operator_id VARCHAR(20) NOT NULL,
  product ENUM('letter', 'whisper') NOT NULL,
  status ENUM('issued', 'sending', 'delivered', 'failed') NOT NULL DEFAULT 'issued',
  recipient_id VARCHAR(20) NULL,
  delivery_channel_id VARCHAR(20) NULL,
  delivery_message_id VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  delivered_at DATETIME NULL,
  UNIQUE KEY uq_dark_message_channel (delivery_channel_id),
  KEY idx_dark_message_buyer (buyer_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
