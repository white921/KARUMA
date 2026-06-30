import { ModalSubmitInteraction, GuildMember } from "discord.js";

import { SendService } from "../service/sendService";
import { AdminBurnService } from "../service/adminBurnService";
import { DiaryService } from "../service/diaryService";
import { showConfirmButton } from "../util/button";

import { PANEL_COMMAND_NAMES } from "../constant/command";
import { AdminMintService } from "../service/adminMintService";
import { VcService } from "../service/vcService";
import { DiaryType } from "../constant/diary";
import { AETHER_BOT_ID } from "../constant/id";
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
    switch (commandId) {
      // VC名変更のときはamount/commentがないので分けないとエラーがでる
      case PANEL_COMMAND_NAMES.CHANGE_VC_NAME: {
        const newName = getModalFieldValue(interaction, "new_name");
        await VcService.changeVcName(interaction, newName);
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
        await SendService.send(
          interaction,
          interaction.user.id,
          AETHER_BOT_ID,
          amount,
          comment,
          commandId,
        );
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
          await SendService.send(
            interaction,
            fromUserId,
            toUserId,
            amount,
            comment,
            commandId,
          );
        }
        break;
      }
    }
  } catch (error) {
    throw error;
  }
}
