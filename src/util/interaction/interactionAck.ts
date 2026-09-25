import { HISTORY_FILTER_PREFIX } from "../../service/currency/historyFilter";
import { CAST_PAYMENT_PREFIX } from "../../constant/cast/castPayment";
import { GACHA_COIN_PREFIX } from "../../constant/market/gachaCoin";
import { DARK_DISCLOSURE_PREFIX, DARK_MESSAGE_CLOSE_PREFIX } from "../../constant/market/darkMessage";
import { TICKET_EXCHANGE_PREFIX, TICKET_EXCHANGE_STEP_PREFIX } from "../../constant/inventory/ticketExchange";
import { PRIVATE_HOTEL_PREFIX } from "../../constant/hotel/privateHotel";
import { CREATOR_EMBLEM_CANCEL_ID, CREATOR_EMBLEM_CONFIRM_PREFIX } from "../../constant/market/creatorEmblem";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { PAYMENT_CONFIRMATION_PREFIX } from "../../constant/currency/paymentConfirmation";

/** ボタンが付いているメッセージを更新して応答するかどうかを判定する。 */
export function shouldDeferButtonUpdate(customId: string): boolean {
  return (
    customId.startsWith(`${PANEL_COMMAND_NAMES.HAZAMA_CONFIRM}:`) ||
    customId.startsWith(`${PANEL_COMMAND_NAMES.HAZAMA_CANCEL}:`) ||
    customId === PANEL_COMMAND_NAMES.SOLITARY_CELL_CONFIRM ||
    customId === PANEL_COMMAND_NAMES.SOLITARY_CELL_CANCEL ||
    customId.startsWith(`${PANEL_COMMAND_NAMES.SOLITARY_CELL_CONFIRM}:`) ||
    customId.startsWith(`${PANEL_COMMAND_NAMES.SOLITARY_CELL_CANCEL}:`) ||
    customId.startsWith(`${DARK_MESSAGE_CLOSE_PREFIX}:confirm:`) ||
    customId.startsWith(`${DARK_MESSAGE_CLOSE_PREFIX}:cancel:`) ||
    (customId.startsWith(`${CAST_PAYMENT_PREFIX}:`) &&
      !customId.startsWith(`${CAST_PAYMENT_PREFIX}:start:`) &&
      !customId.startsWith(`${CAST_PAYMENT_PREFIX}:option:`)) ||
    customId.startsWith(`${DARK_DISCLOSURE_PREFIX}:confirm:`) ||
    customId.startsWith(`${DARK_DISCLOSURE_PREFIX}:cancel:`) ||
    customId.startsWith(`${GACHA_COIN_PREFIX}:confirm:`) ||
    customId.startsWith(`${GACHA_COIN_PREFIX}:cancel:`) ||
    customId.startsWith(TICKET_EXCHANGE_STEP_PREFIX) ||
    customId.startsWith(`${PAYMENT_CONFIRMATION_PREFIX}:`) ||
    customId.startsWith(`${TICKET_EXCHANGE_PREFIX}:confirm:`) ||
    customId.startsWith(`${TICKET_EXCHANGE_PREFIX}:cancel:`) ||
    (customId.startsWith(PRIVATE_HOTEL_PREFIX) && customId.split(":").length > 2) ||
    customId.startsWith("history_page_") ||
    customId.startsWith(HISTORY_FILTER_PREFIX) ||
    customId.startsWith(`${CREATOR_EMBLEM_CONFIRM_PREFIX}:`) ||
    customId === CREATOR_EMBLEM_CANCEL_ID ||
    customId === PANEL_COMMAND_NAMES.GAME_PASS_TWO_WEEKS_CONFIRM ||
    customId === PANEL_COMMAND_NAMES.GAME_PASS_ONE_MONTH_CONFIRM ||
    customId === PANEL_COMMAND_NAMES.GAME_PASS_CANCEL
  );
}
