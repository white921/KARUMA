import { HistoryService } from "../../service/currency/historyService";
import { HISTORY_FILTER_PREFIX } from "../../service/currency/historyFilter";
import { CastPaymentService } from "../../service/cast/castPaymentService";
import { CAST_PAYMENT_PREFIX } from "../../constant/cast/castPayment";
import { GACHA_COIN_PREFIX } from "../../constant/market/gachaCoin";
import { handleGachaCoinSelect } from "../../service/market/gachaCoinInteractionService";
import { TICKET_EXCHANGE_PREFIX } from "../../constant/inventory/ticketExchange";
import { showTicketExchangeQuantity } from "../../service/inventory/ticketExchangeInteractionService";
import { StringSelectMenuInteraction } from "discord.js";
import {
  CREATOR_EMBLEM_PRODUCT_SELECT_ID,
} from "../../constant/market/creatorEmblem";

import { showConfirmButton } from "../../util/interaction/button";
import { showShopAmountModal } from "../../util/interaction/modal";
import { showSelectUserMenu } from "../../util/interaction/select";

import { RouletteService } from "../../service/casino/rouletteService";
import { HotelFreeTicketService } from "../../service/hotel/hotelFreeTicketService";
import { CreatorEmblemPaymentService } from "../../service/market/creatorEmblemPaymentService";
import { SuperchatService } from "../../service/market/superchatService";
import { VcService } from "../../service/vc/vcService";
import { RouletteBetKind, RouletteStage } from "../../type/casino/roulette";

import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { HOTEL_MESSAGES, HOTEL_PURCHASE_WAY_TYPE } from "../../constant/hotel/hotel";
import { isShopTicketType, SHOP_TICKET_NONE } from "../../constant/market/shopTicket";

/**
 * 文字列のプルダウンを選択した時のハンドラ
 * @param interaction
 * @returns
 */
export async function handleStringSelectMenu(
  interaction: StringSelectMenuInteraction,
) {
  try {
    const customId = interaction.customId;
    if (customId.startsWith(HISTORY_FILTER_PREFIX)) {
      await HistoryService.handleFilter(interaction);
      return;
    }
    if (customId.startsWith(`${CAST_PAYMENT_PREFIX}:`)) {
      await CastPaymentService.handle(interaction);
      return;
    }
    if (customId === `${GACHA_COIN_PREFIX}:select`) {
      await handleGachaCoinSelect(interaction);
      return;
    }
    if (customId === `${TICKET_EXCHANGE_PREFIX}:select`) {
      await showTicketExchangeQuantity(interaction);
      return;
    }
    if (customId === PANEL_COMMAND_NAMES.SUPERCHAT_STREAMER_SELECT) {
      await SuperchatService.showStageSelect(interaction);
      return;
    }
    if (customId.startsWith(`${PANEL_COMMAND_NAMES.SUPERCHAT_STAGE_SELECT}:`)) {
      await SuperchatService.showAmountModal(interaction);
      return;
    }
    if (customId.startsWith("rouletteBetSelect_")) {
      const stage = Number(customId.split("_")[1]);
      if (stage !== 1 && stage !== 2 && stage !== 3) {
        throw new Error("ルーレットの部の情報が不正です。");
      }
      await RouletteService.showBetAmountModal(
        interaction,
        stage as RouletteStage,
        interaction.values[0] as RouletteBetKind,
      );
      return;
    }
    if (customId.startsWith("rouletteDozenSelect_")) {
      const stage = Number(customId.split("_")[1]);
      if (stage !== 1 && stage !== 2 && stage !== 3) {
        throw new Error("ルーレットの部の情報が不正です。");
      }
      await RouletteService.showBetAmountModal(
        interaction,
        stage as RouletteStage,
        "dozen",
        interaction.values[0],
      );
      return;
    }
    if (customId === "shop_ticket_select") {
      const ticketType = interaction.values[0];
      if (ticketType !== SHOP_TICKET_NONE && !isShopTicketType(ticketType)) {
        throw new Error("無効な市場チケットです。");
      }
      await showShopAmountModal(interaction, ticketType);
      return;
    }
    if (customId === CREATOR_EMBLEM_PRODUCT_SELECT_ID) {
      await CreatorEmblemPaymentService.showConfirmation(interaction);
      return;
    }
    const commandId = customId.split("_")[0]; // NORMAL, SECRET, SECRETLONG, FREEDOM, FREEDOMLONG
    switch (customId) {
      case "change_vc_limit_select": // VC人数変更の処理
        const selectedLimit = parseInt(interaction.values[0]);
        await VcService.updateVcLimit(interaction, selectedLimit);
        break;
      default:
        // ホテル購入方法選択の処理
        const selectedHotelPurchaseWay = interaction.values[0]; // (LIA, チケット)
        if (
          commandId === PANEL_COMMAND_NAMES.HOTEL_VC_SECRET ||
          commandId === PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG
        ) {
          // TODO
          // チケットのバリデーションのためのif
          // もう少し綺麗にしたい
          if (selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.TICKET) {
            if (!(await HotelFreeTicketService.hasTicket(interaction.user.id, commandId))) {
              throw new Error(HOTEL_MESSAGES.HAS_NOT_TICKET);
            }
          }
          await showSelectUserMenu(
            interaction,
            HOTEL_MESSAGES.SELECT_USER,
            commandId,
            selectedHotelPurchaseWay,
          );
          return;
        }

        switch (selectedHotelPurchaseWay) {
          case HOTEL_PURCHASE_WAY_TYPE.MONEY:
            await showConfirmButton(
              interaction,
              commandId,
              selectedHotelPurchaseWay,
            );
            break;
          case HOTEL_PURCHASE_WAY_TYPE.TICKET:
            if (!(await HotelFreeTicketService.hasTicket(interaction.user.id, commandId))) {
              throw new Error(HOTEL_MESSAGES.HAS_NOT_TICKET);
            }
            await showConfirmButton(
              interaction,
              commandId,
              selectedHotelPurchaseWay,
            );
            break;
        }
    }
  } catch (error: any) {
    throw error;
  }
}
