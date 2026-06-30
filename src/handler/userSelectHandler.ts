import { UserSelectMenuInteraction } from "discord.js";

import { showAmountModal } from "../util/modal";
import { showConfirmButton } from "../util/button";

import { AdminViewService } from "../service/adminViewService";

import { PANEL_MESSAGES } from "../constant/panel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { ADMIN_PANEL_MESSAGES } from "../constant/panel";
import { HOTEL_MESSAGES } from "../constant/hotel";
import { CASINO_MESSAGES } from "../constant/casino";

/**
 * ユーザー選択メニューを押したときのハンドラー
 * @param interaction ユーザー選択メニューインタラクション
 */
export async function handleUserSelectMenu(
  interaction: UserSelectMenuInteraction
) {
  const customId = interaction.customId;
  const customIdParts = customId.split("_");
  const commandId = customIdParts[0]; // NORMAL, SECRET, SECRETLONG, FREEDOM, FREEDOMLONG
  const selectedHotelPurchaseWay =
    customIdParts.length > 3 ? customIdParts[3] : undefined; // (Royal, チケット) または undefined(無料ロールの場合)
  const selectedUserId = interaction.values[0];
  switch (commandId) {
    case PANEL_COMMAND_NAMES.SEND:
      await showAmountModal(
        interaction,
        interaction.user.id,
        selectedUserId,
        PANEL_MESSAGES.SEND,
        PANEL_COMMAND_NAMES.SEND
      );
      break;
    case PANEL_COMMAND_NAMES.ADMIN_VIEW:
      await AdminViewService.adminView(interaction, selectedUserId);
      break;
    case PANEL_COMMAND_NAMES.ADMIN_MINT:
      await showAmountModal(
        interaction,
        interaction.user.id,
        selectedUserId,
        ADMIN_PANEL_MESSAGES.MINT,
        PANEL_COMMAND_NAMES.ADMIN_MINT
      );
      break;
    case PANEL_COMMAND_NAMES.ADMIN_BURN:
      await showAmountModal(
        interaction,
        interaction.user.id,
        selectedUserId,
        ADMIN_PANEL_MESSAGES.BURN,
        PANEL_COMMAND_NAMES.ADMIN_BURN
      );
      break;
    case PANEL_COMMAND_NAMES.HOTEL_VC_SECRET:
    case PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG:
      if (selectedUserId == interaction.user.id) {
        throw new Error(HOTEL_MESSAGES.DO_NOT_SELECT_MYSELF);
      }
      await showConfirmButton(interaction, commandId, selectedHotelPurchaseWay);
      break;
    case PANEL_COMMAND_NAMES.CASINO_GF:
      await showAmountModal(
        interaction,
        interaction.user.id,
        selectedUserId,
        CASINO_MESSAGES.SEND_FOR_GF,
        PANEL_COMMAND_NAMES.CASINO_GF
      );
      break;
    case PANEL_COMMAND_NAMES.CASINO_MAJONG:
      await showAmountModal(
        interaction,
        interaction.user.id,
        selectedUserId,
        CASINO_MESSAGES.SEND_FOR_MAJONG,
        PANEL_COMMAND_NAMES.CASINO_MAJONG
      );
      break;
    case PANEL_COMMAND_NAMES.CASINO_OTHER:
      await showAmountModal(
        interaction,
        interaction.user.id,
        selectedUserId,
        CASINO_MESSAGES.SEND_FOR_OTHER,
        PANEL_COMMAND_NAMES.CASINO_OTHER
      );
      break;
    default:
      await interaction.reply({
        content: PANEL_MESSAGES.BUTTON_NOT_FOUND,
        ephemeral: true,
      });
      break;
  }
}
