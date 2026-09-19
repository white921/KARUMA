import type { ShopPaymentCommandName } from "../market/shopPayment";
import type { ShopTicketType } from "../market/shopTicket";
import type { SuperchatStage } from "../market/superchat";

export type PendingPayment = {
  amount: number;
  comment: string;
} & (
  | { kind: "shop"; commandName: ShopPaymentCommandName; ticketType: ShopTicketType | "none" }
  | { kind: "send"; commandName: string; toUserId: string }
  | { kind: "superchat"; streamerId: string; stage: SuperchatStage }
);

export interface PaymentConfirmationSession {
  userId: string;
  guildId: string | null;
  channelId: string | null;
  expiresAt: number;
  payment: PendingPayment;
}
