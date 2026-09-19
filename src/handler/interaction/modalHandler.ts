import { TICKET_EXCHANGE_PREFIX } from "../../constant/inventory/ticketExchange";
import { confirmTicketExchangeModal } from "../../service/inventory/ticketExchangeInteractionService";
import { GuildMember, ModalSubmitInteraction } from "discord.js";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { SHOP_TICKET_NONE, isShopTicketType } from "../../constant/market/shopTicket";
import { RouletteService } from "../../service/casino/rouletteService";
import { AdminBurnService } from "../../service/currency/adminBurnService";
import { AdminMintService } from "../../service/currency/adminMintService";
import { PaymentConfirmationService } from "../../service/currency/paymentConfirmationService";
import { DiaryService } from "../../service/diary/diaryService";
import { VcService } from "../../service/vc/vcService";
import type { DiaryType } from "../../type/diary/diary";
import { showConfirmButton } from "../../util/interaction/button";

/**
 * モーダルフィールドの値を取得
 * @param interaction モーダルサブミットインタラクション
 * @param fieldId フィールドID
 * @returns フィールドの値（存在しない場合はundefined）
 */
function getModalFieldValue(
  interaction: ModalSubmitInteraction,
  fieldId: string,
): string {
  if (interaction.fields.fields.has(fieldId)) {
    return interaction.fields.getTextInputValue(fieldId);
  }
  return "";
}

/**
 * モーダルサブミットを処理するハンドラー
 * @param interaction モーダルサブミットインタラクション
 */
export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  const customId = interaction.customId;
  const commandId = customId.includes("_") ? customId.split("_")[0] : customId;

  try {
    if (customId.startsWith(`${TICKET_EXCHANGE_PREFIX}:quantity:`)) {
      await confirmTicketExchangeModal(interaction);
      return;
    }
    if (customId.startsWith(`${PANEL_COMMAND_NAMES.SUPERCHAT_SEND}:`)) {
      const amount = Number(getModalFieldValue(interaction, "amount"));
      const comment = getModalFieldValue(interaction, "comment");
      const [, streamerId, stage] = customId.split(":");
      if (stage !== "singer" && stage !== "voice") throw new Error("無効なステージです。");
      await PaymentConfirmationService.show(interaction, {
        kind: "superchat", amount, comment, streamerId, stage,
      });
      return;
    }
    if (customId.startsWith("rouletteBetModal_")) {
      await RouletteService.showBetConfirmation(interaction);
      return;
    }
    switch (commandId) {
      // VC名変更のときはamount/commentがないので分けないとエラーがでる
      case PANEL_COMMAND_NAMES.CHANGE_VC_NAME: {
        const newName = getModalFieldValue(interaction, "new_name");
        await VcService.changeVcName(interaction, newName);
        break;
      }
      case PANEL_COMMAND_NAMES.CHANGE_VC_STATUS: {
        const newStatus = getModalFieldValue(interaction, "new_status");
        await VcService.changeVcStatus(interaction, newStatus);
        break;
      }
      case PANEL_COMMAND_NAMES.DIARY_PRIVATE:
      case PANEL_COMMAND_NAMES.DIARY_PUBLIC: {
        const title = getModalFieldValue(interaction, "title");
        const body = getModalFieldValue(interaction, "body");
        if (await DiaryService.isFree(interaction.member as GuildMember)) {
          await DiaryService.createDiary(
            interaction,
            commandId as DiaryType,
            title,
            body,
          );
        } else {
          DiaryService.setPendingDiaryAction(
            interaction.user.id,
            commandId,
            title,
            body,
          );
          await showConfirmButton(interaction, commandId);
        }
        break;
      }
      case PANEL_COMMAND_NAMES.DIARY_UPDATE: {
        const title = getModalFieldValue(interaction, "title");
        const body = getModalFieldValue(interaction, "body");
        if (await DiaryService.isFree(interaction.member as GuildMember)) {
          await DiaryService.updateDiary(interaction, title, body);
        } else {
          DiaryService.setPendingDiaryAction(
            interaction.user.id,
            commandId,
            title,
            body,
          );
          await showConfirmButton(interaction, commandId);
        }
        break;
      }
      case PANEL_COMMAND_NAMES.SHOP_SEND: {
        const amount = Number(getModalFieldValue(interaction, "amount"));
        const comment = getModalFieldValue(interaction, "comment");
        const ticketType = customId.slice(
          `${PANEL_COMMAND_NAMES.SHOP_SEND}_`.length,
        );
        if (ticketType !== SHOP_TICKET_NONE && !isShopTicketType(ticketType)) {
          throw new Error("無効な市場チケットです。");
        }
        await PaymentConfirmationService.show(interaction, {
          kind: "shop", amount, comment, ticketType, commandName: commandId,
        });
        break;
      }
      case PANEL_COMMAND_NAMES.COURT_SHOP_SEND:
      case PANEL_COMMAND_NAMES.DARK_SHOP_SEND: {
        const amount = Number(getModalFieldValue(interaction, "amount"));
        const comment = getModalFieldValue(interaction, "comment");
        await PaymentConfirmationService.show(interaction, {
          kind: "shop", amount, comment, ticketType: SHOP_TICKET_NONE, commandName: commandId,
        });
        break;
      }
      default: {
        const parts = customId.split("_");
        const fromUserId = parts[1];
        const toUserId = parts[2];
        const amount = Number(getModalFieldValue(interaction, "amount"));
        const comment = getModalFieldValue(interaction, "comment");
        if (commandId == PANEL_COMMAND_NAMES.ADMIN_MINT) {
          await AdminMintService.mint(interaction, toUserId, amount, comment);
        } else if (commandId == PANEL_COMMAND_NAMES.ADMIN_BURN) {
          await AdminBurnService.burn(interaction, toUserId, amount, comment);
        } else {
          if (fromUserId !== interaction.user.id) throw new Error("無効な送金元です。");
          await PaymentConfirmationService.show(interaction, {
            kind: "send", amount, comment, toUserId, commandName: commandId,
          });
        }
        break;
      }
    }
  } catch (error) {
    throw error;
  }
}
