import { ButtonInteraction, GuildMember } from "discord.js";

import {
  showStringSelectMenu,
  showSelectUserMenu,
  showSelectNumberMenu,
} from "../util/select";
import { showConfirmButton } from "../util/button";
import { showStringModal, showAmountModal } from "../util/modal";
import { hasRole } from "../util/role";

import { ViewService } from "../service/viewService";
import { HistoryService } from "../service/historyService";
import { HotelVcService } from "../service/hotelVcService";
import { AccountService } from "../service/accountService";
import { VcService } from "../service/vcService";
import { GameService } from "../service/gameService";
import { DiaryService } from "../service/diaryService";
import { RedeployService } from "../service/redeployService";

import {
  ADMIN_PANEL_MESSAGES,
  PANEL_MESSAGES,
  HOTEL_VC_PANEL_MESSAGES,
  SHOP_PANEL_MESSAGES,
} from "../constant/panel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { ROLE_IDS, BOT_ID } from "../constant/id";
import { CASINO_MESSAGES } from "../constant/casino";
import {
  HOTEL_TYPE_NAMES,
  HOTEL_TYPE,
  HOTEL_MESSAGES,
  HOTEL_PURCHASE_WAY_TYPE,
} from "../constant/hotel";
import { ACCOUNT_MESSAGES } from "../constant/account";
import { VC_MESSAGES } from "../constant/vc";
import { DIARY_MESSAGES } from "../constant/diary";
/**
 * パネルボタンを押したときのハンドラー
 * @param interaction ボタンインタラクション
 */
export async function handlePanelButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  // 口座が存在しない場合はエラーを返す
  if (!(await AccountService.hasAccount(interaction.user.id))) {
    throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
  }

  try {
    switch (customId) {
      case PANEL_COMMAND_NAMES.SEND:
        await showSelectUserMenu(
          interaction,
          PANEL_MESSAGES.SEND,
          PANEL_COMMAND_NAMES.SEND,
        );
        break;
      case PANEL_COMMAND_NAMES.SHOP_SEND:
        await showAmountModal(
          interaction,
          BOT_ID,
          interaction.user.id,
          SHOP_PANEL_MESSAGES.SHOP_SEND,
          PANEL_COMMAND_NAMES.SHOP_SEND,
        );
        break;
      case PANEL_COMMAND_NAMES.VIEW:
        await ViewService.view(interaction);
        break;
      case PANEL_COMMAND_NAMES.HISTORY:
        await HistoryService.viewHistory(interaction, 1);
        break;
      case PANEL_COMMAND_NAMES.DIARY_PRIVATE:
        if (
          await hasRole(interaction.member as GuildMember, ROLE_IDS.SUB_ACCOUNT)
        ) {
          throw new Error(DIARY_MESSAGES.SUB_ACCOUNT_NOT_ALLOWED);
        }
        await showStringModal(
          interaction,
          DIARY_MESSAGES.PRIVATE_CREATE,
          PANEL_COMMAND_NAMES.DIARY_PRIVATE,
          true,
        );
        break;
      case PANEL_COMMAND_NAMES.DIARY_PUBLIC:
        if (
          await hasRole(interaction.member as GuildMember, ROLE_IDS.SUB_ACCOUNT)
        ) {
          throw new Error(DIARY_MESSAGES.SUB_ACCOUNT_NOT_ALLOWED);
        }
        await showStringModal(
          interaction,
          DIARY_MESSAGES.PUBLIC_CREATE,
          PANEL_COMMAND_NAMES.DIARY_PUBLIC,
          true,
        );
        break;
      case PANEL_COMMAND_NAMES.DIARY_UPDATE:
        if (
          await hasRole(interaction.member as GuildMember, ROLE_IDS.SUB_ACCOUNT)
        ) {
          throw new Error(DIARY_MESSAGES.SUB_ACCOUNT_NOT_ALLOWED);
        }
        await showStringModal(
          interaction,
          DIARY_MESSAGES.UPDATE,
          PANEL_COMMAND_NAMES.DIARY_UPDATE,
          true,
        );
        break;
      case PANEL_COMMAND_NAMES.ADMIN_VIEW:
        await showSelectUserMenu(
          interaction,
          ADMIN_PANEL_MESSAGES.VIEW,
          PANEL_COMMAND_NAMES.ADMIN_VIEW,
        );
        break;
      case PANEL_COMMAND_NAMES.ADMIN_MINT:
        await showSelectUserMenu(
          interaction,
          ADMIN_PANEL_MESSAGES.MINT,
          PANEL_COMMAND_NAMES.ADMIN_MINT,
        );
        break;
      case PANEL_COMMAND_NAMES.ADMIN_BURN:
        await showSelectUserMenu(
          interaction,
          ADMIN_PANEL_MESSAGES.BURN,
          PANEL_COMMAND_NAMES.ADMIN_BURN,
        );
        break;
      case PANEL_COMMAND_NAMES.REDEPLOY:
        await RedeployService.redeployCurrentService();
        await interaction.reply({
          content:
            "Botを再起動しております。\n各パネルが送信されたら再起動は完了です。\nご対応ありがとうございました。",
          ephemeral: true,
        });
        break;
      // case PANEL_COMMAND_NAMES.ADMIN_CHANGE_NAME:
      //   await showStringModal(
      //     interaction,
      //     ADMIN_PANEL_MESSAGES.CHANGE_NAME,
      //     PANEL_COMMAND_NAMES.ADMIN_CHANGE_NAME
      //   );
      //   break;
      case PANEL_COMMAND_NAMES.CHANGE_VC_LIMIT:
        await VcService.validateVcMember(interaction);
        await showSelectNumberMenu(interaction);
        break;
      case PANEL_COMMAND_NAMES.CHANGE_VC_NAME:
        await VcService.validateVcMember(interaction);
        await showStringModal(
          interaction,
          VC_MESSAGES.CHANGE_VC_NAME,
          PANEL_COMMAND_NAMES.CHANGE_VC_NAME,
        );
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL:
        if (
          (await hasRole(
            interaction.member as GuildMember,
            ROLE_IDS.CORE_MEMBER_ROLES.HONMEN,
          )) ||
          (await hasRole(
            interaction.member as GuildMember,
            ROLE_IDS.KANRISYA,
          )) ||
          (await hasRole(interaction.member as GuildMember, ROLE_IDS.SABANUSI))
        ) {
          const voiceChannelId = await HotelVcService.createHotelVc(
            interaction,
            HOTEL_TYPE_NAMES.NORMAL,
            true,
          );
          await HotelVcService.insertIntoVcs(
            voiceChannelId,
            interaction.user.id,
            HOTEL_TYPE.NORMAL,
            false,
            true,
            undefined,
          );
          break;
        }
        // 現在はRoyal支払いのみ。将来的にチケットを戻す場合は showStringSelectMenu を再利用する
        await showConfirmButton(
          interaction,
          PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL,
          HOTEL_PURCHASE_WAY_TYPE.MONEY,
        );
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_SECRET:
        // 現在はRoyal支払いのみ。将来的にチケットを戻す場合は showStringSelectMenu を再利用する
        await showSelectUserMenu(
          interaction,
          HOTEL_MESSAGES.SELECT_USER,
          PANEL_COMMAND_NAMES.HOTEL_VC_SECRET,
          HOTEL_PURCHASE_WAY_TYPE.MONEY,
        );
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG:
        // 現在はRoyal支払いのみ。将来的にチケットを戻す場合は showStringSelectMenu を再利用する
        await showSelectUserMenu(
          interaction,
          HOTEL_MESSAGES.SELECT_USER,
          PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG,
          HOTEL_PURCHASE_WAY_TYPE.MONEY,
        );
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM:
        // 現在はRoyal支払いのみ。将来的にチケットを戻す場合は showStringSelectMenu を再利用する
        await showConfirmButton(
          interaction,
          PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM,
          HOTEL_PURCHASE_WAY_TYPE.MONEY,
        );
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOMLONG:
        // 現在はRoyal支払いのみ。将来的にチケットを戻す場合は showStringSelectMenu を再利用する
        await showConfirmButton(
          interaction,
          PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOMLONG,
          HOTEL_PURCHASE_WAY_TYPE.MONEY,
        );
        break;
      case PANEL_COMMAND_NAMES.CASINO_GF:
        await showSelectUserMenu(
          interaction,
          CASINO_MESSAGES.SEND_FOR_GF,
          PANEL_COMMAND_NAMES.CASINO_GF,
        );
        break;
      case PANEL_COMMAND_NAMES.CASINO_MAJONG:
        await showSelectUserMenu(
          interaction,
          CASINO_MESSAGES.SEND_FOR_MAJONG,
          PANEL_COMMAND_NAMES.CASINO_MAJONG,
        );
        break;
      case PANEL_COMMAND_NAMES.CASINO_OTHER:
        await showSelectUserMenu(
          interaction,
          CASINO_MESSAGES.SEND_FOR_OTHER,
          PANEL_COMMAND_NAMES.CASINO_OTHER,
        );
        break;
      case PANEL_COMMAND_NAMES.GAME_SHORT:
      case PANEL_COMMAND_NAMES.GAME_LONG:
        if (await GameService.isFree(interaction.member as GuildMember)) {
          await GameService.buyGameRole(interaction, customId, false);
        } else {
          await showConfirmButton(interaction, customId);
        }
        break;
      case PANEL_COMMAND_NAMES.GAME_PASS:
        await showConfirmButton(interaction, customId);
        break;
      default:
        // ページネーションボタンの処理
        if (customId.startsWith("history_page_")) {
          const page = parseInt(customId.split("_")[2]);
          await HistoryService.viewHistory(interaction, page);
          break;
        }
        // 「作成」ボタンまたは「キャンセル」ボタンの処理
        if (customId === "cancel") {
          // キャンセルボタンの処理
          if (interaction.deferred) {
            await interaction.editReply({
              content: HOTEL_VC_PANEL_MESSAGES.CANCEL,
            });
          } else {
            await interaction.reply({
              content: HOTEL_VC_PANEL_MESSAGES.CANCEL,
              ephemeral: true,
            });
          }
        } else if (customId.includes("_hotel_create_")) {
          // 作成ボタンの処理
          // customId形式: {commandId}_hotel_create_{purchaseWay}_{userId}
          // 例: NORMAL_hotel_create_Royal_1234567890
          const parts = customId.split("_");
          const commandId = parts[0]; // NORMAL, SECRET, SECRETLONG, FREEDOM, FREEDOMLONG
          const selectedHotelPurchaseWay = parts[3]; // (Royal, チケット)
          const selectedUserId = parts[4]; // 選択されたユーザーID (user_not_selected or ユーザーID)
          await HotelVcService.executeHotelVc(
            interaction,
            commandId,
            selectedHotelPurchaseWay,
            false,
            selectedUserId,
          );
        } else if (customId.includes("_game_confirm")) {
          // ゲーム購入確定ボタンの処理
          // customId形式: {commandId}_game_confirm
          // 例: gameShort_game_confirm, gameShortExtend_game_confirm
          const parts = customId.split("_");
          const commandId = parts[0];
          const isExtend = commandId.endsWith("Extend"); // 延長購入かどうか

          switch (commandId) {
            case PANEL_COMMAND_NAMES.GAME_SHORT:
            case PANEL_COMMAND_NAMES.GAME_LONG:
              await GameService.buyGameRole(interaction, commandId, isExtend);
              break;
            case PANEL_COMMAND_NAMES.GAME_PASS:
              await GameService.buyGamePass(interaction, commandId);
              break;
            default:
              throw new Error(PANEL_MESSAGES.BUTTON_NOT_FOUND);
          }
          break;
        } else if (customId.includes("_diary_confirm")) {
          const commandId = customId.replace("_diary_confirm", "");
          const pending = DiaryService.consumePendingDiaryAction(
            interaction.user.id,
            commandId,
          );

          if (!pending) {
            throw new Error(
              "日記の確認情報が見つかりません。もう一度最初からやり直してください。",
            );
          }

          switch (commandId) {
            case PANEL_COMMAND_NAMES.DIARY_PRIVATE:
              await DiaryService.createDiary(
                interaction,
                commandId as any,
                pending.title,
                pending.body,
              );
              break;
            case PANEL_COMMAND_NAMES.DIARY_PUBLIC:
              await DiaryService.createDiary(
                interaction,
                commandId as any,
                pending.title,
                pending.body,
              );
              break;
            case PANEL_COMMAND_NAMES.DIARY_UPDATE:
              await DiaryService.updateDiary(
                interaction,
                pending.title,
                pending.body,
              );
              break;
            default:
              throw new Error(PANEL_MESSAGES.BUTTON_NOT_FOUND);
          }
          break;
        }
    }
  } catch (error: any) {
    throw error;
  }
}
