import type { RowDataPacket } from "mysql2/promise";
import type { PANEL_COMMAND_NAMES } from "../constant/command";

export type WalletRow = RowDataPacket & { wallet: number };

export type ShopPaymentCommandName =
  | typeof PANEL_COMMAND_NAMES.SHOP_SEND
  | typeof PANEL_COMMAND_NAMES.DARK_SHOP_SEND
  | typeof PANEL_COMMAND_NAMES.COURT_SHOP_SEND;
