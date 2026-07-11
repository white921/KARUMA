import { StringSelectMenuInteraction } from "discord.js";

import { showConfirmButton } from "../util/button";
import { showSelectUserMenu } from "../util/select";

import { HotelVcService } from "../service/hotelVcService";
import { VcService } from "../service/vcService";
import { RouletteService } from "../service/rouletteService";
import { RouletteBetKind, RouletteStage } from "../type/roulette";

import { HOTEL_PURCHASE_WAY_TYPE } from "../constant/hotel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { HOTEL_MESSAGES } from "../constant/hotel";

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
    const commandId = customId.split("_")[0]; // NORMAL, SECRET, SECRETLONG, FREEDOM, FREEDOMLONG
    switch (customId) {
      case "change_vc_limit_select": // VC人数変更の処理
        const selectedLimit = parseInt(interaction.values[0]);
        await VcService.updateVcLimit(interaction, selectedLimit);
        break;
      default:
        // ホテル購入方法選択の処理
        const selectedHotelPurchaseWay = interaction.values[0]; // (Royal, チケット)
        if (
          commandId === PANEL_COMMAND_NAMES.HOTEL_VC_SECRET ||
          commandId === PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG
        ) {
          // TODO
          // チケットのバリデーションのためのif
          // もう少し綺麗にしたい
          if (selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.TICKET) {
            await HotelVcService.validateTicket(interaction);
          }
          showSelectUserMenu(
            interaction,
            HOTEL_MESSAGES.SELECT_USER,
            commandId,
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
            await HotelVcService.validateTicket(interaction);
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
