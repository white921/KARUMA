import type { Client, Guild } from "discord.js";

export interface ReceiptDmContext {
  client: Client;
  guild?: Guild | null;
}

export interface CurrencyReceipt {
  actionType: string;
  recipientId: string;
  senderId?: string;
  amount: number;
  afterWallet: number;
  comment?: string;
  fields?: Array<{ name: string; value: string }>;
}

export interface ReceiptDmDefinition {
  title: string;
  verb: string;
  balanceLabel: string;
  humanSender?: boolean;
  commentLabel?: string;
}
