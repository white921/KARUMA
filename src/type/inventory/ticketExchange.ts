import type { RowDataPacket } from "mysql2/promise";
import type { ItemKey } from "./item";

export interface TicketExchangeDraft {
  id: string;
  userId: string;
  itemKey: ItemKey;
  label: string;
  unitPrice: number;
  owned: number;
  quantity: number;
  maximum: number;
  revision: number;
  expiresAt: number;
  requestCreated: boolean;
  cancelled: boolean;
  result?: TicketExchangeResult;
  seenInteractions: Set<string>;
  tail: Promise<void>;
}

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
