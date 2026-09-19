import type { RowDataPacket } from "mysql2/promise";

export interface TicketExchangeResult {
  label: string;
  quantity: number;
  amount: number;
  afterWallet: number;
  afterQuantity: number;
  alreadyCompleted: boolean;
}

export interface ExchangeRequest extends RowDataPacket {
  user_id: string;
  item_key: string;
  quantity: number;
  unit_price: number;
  status: string;
  after_wallet: number | null;
  after_quantity: number | null;
  expired: number;
}
