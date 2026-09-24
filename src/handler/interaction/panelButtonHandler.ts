import { HISTORY_FILTER_PREFIX } from "../../service/currency/historyFilter";
import { CastPaymentService } from "../../service/cast/castPaymentService";
import { CAST_PAYMENT_PREFIX } from "../../constant/cast/castPayment";
import { DARK_DISCLOSURE_PREFIX, DARK_MESSAGE_PREFIX, DARK_MESSAGE_CLOSE_PREFIX } from "../../constant/market/darkMessage";
import { DarkMessageCloseService } from "../../service/market/darkMessageCloseService";
import { DarkDisclosureService } from "../../service/market/darkDisclosureService";
import { DarkMessageService } from "../../service/market/darkMessageService";
import { GACHA_COIN_PREFIX } from "../../constant/market/gachaCoin";
import { handleGachaCoinButton } from "../../service/market/gachaCoinInteractionService";
import { TICKET_EXCHANGE_PREFIX, TICKET_EXCHANGE_STEP_PREFIX } from "../../constant/inventory/ticketExchange";
import { PAYMENT_CONFIRMATION_PREFIX } from "../../constant/currency/paymentConfirmation";
import { PaymentConfirmationService } from "../../service/currency/paymentConfirmationService";
import { handleTicketExchangeButton } from "../../service/inventory/ticketExchangeInteractionService";
import { PrivateHotelService } from "../../service/hotel/privateHotelService";
import { PRIVATE_HOTEL_PREFIX } from "../../constant/hotel/privateHotel";
import { CREATOR_EMBLEM_CANCEL_ID } from "../../constant/market/creatorEmblem";
import { ButtonInteraction, GuildMember } from "discord.js";

import {
  showSelectUserMenu,
  showSelectNumberMenu,
  showShopTicketSelectMenu,
} from "../../util/interaction/select";
import { showConfirmButton } from "../../util/interaction/button";
import {
  showAmountModal,
  showDarkShopAmountModal,
  showCourtShopAmountModal,
  showStringModal,
  showVcStatusModal,
} from "../../util/interaction/modal";
import { hasRole } from "../../util/member/role";

import { ViewService } from "../../service/currency/viewService";
import { HistoryService } from "../../service/currency/historyService";
import { HotelVcService } from "../../service/hotel/hotelVcService";
import { AccountService } from "../../service/account/accountService";
import { VcService } from "../../service/vc/vcService";
import { GameService } from "../../service/game/gameService";
import { GameVcService } from "../../service/game/gameVcService";
import { DiaryService } from "../../service/diary/diaryService";
import { RedeployService } from "../../service/system/redeployService";
import { RouletteService } from "../../service/casino/rouletteService";
import { MarketGachaService } from "../../service/market/marketGachaService";
import { HotelFreeTicketService } from "../../service/hotel/hotelFreeTicketService";
import { GameFreeTicketService } from "../../service/game/gameFreeTicketService";
import { TicketViewService } from "../../service/inventory/ticketViewService";
import { OmikujiService } from "../../service/omikuji/omikujiService";
import { CreatorEmblemPaymentService } from "../../service/market/creatorEmblemPaymentService";
import { HazamaService } from "../../service/vc/hazamaService";
import { SuperchatService } from "../../service/market/superchatService";
import { SolitaryCellService } from "../../service/vc/solitaryCellService";

import {
  ADMIN_PANEL_MESSAGES,
  PANEL_MESSAGES,
  HOTEL_VC_PANEL_MESSAGES,
} from "../../constant/panel/panel";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { ROLE_IDS } from "../../constant/shared/id";
import { CASINO_MESSAGES } from "../../constant/casino/casino";
import {
  HOTEL_TYPE_NAMES,
  HOTEL_TYPE,
  HOTEL_MESSAGES,
  HOTEL_PURCHASE_WAY_TYPE,
} from "../../constant/hotel/hotel";
import { ACCOUNT_MESSAGES } from "../../constant/account/account";
import { VC_MESSAGES } from "../../constant/vc/vc";
import { DIARY_MESSAGES } from "../../constant/diary/diary";
/**
 * パネルボタンを押したときのハンドラー
 * @param interaction ボタンインタラクション
 */
export async function handlePanelButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  if (customId.startsWith(HISTORY_FILTER_PREFIX)) {
    await HistoryService.handleFilter(interaction);
    return;
  }
  if (customId.startsWith(`${DARK_MESSAGE_CLOSE_PREFIX}:`)) {
    await DarkMessageCloseService.handleButton(interaction);
    return;
  }
  if (customId.startsWith(`${CAST_PAYMENT_PREFIX}:`)) {
    await CastPaymentService.handle(interaction);
    return;
  }
  if (customId.startsWith(`${DARK_DISCLOSURE_PREFIX}:`)) {
    await DarkDisclosureService.handleButton(interaction);
    return;
  }
  if (customId.startsWith(`${DARK_MESSAGE_PREFIX}:`)) {
    await DarkMessageService.start(interaction);
    return;
  }

  // 枚数調整は本人の下書きを検証し、DB照会を省く。確定時はサービス側で口座を再確認する。
  if (customId.startsWith(TICKET_EXCHANGE_STEP_PREFIX)) {
    await handleTicketExchangeButton(interaction);
    return;
  }

  // 口座が存在しない場合はエラーを返す
  if (!(await AccountService.hasAccount(interaction.user.id))) {
    throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
  }

  try {
    if (customId.startsWith(`${GACHA_COIN_PREFIX}:`)) {
      await handleGachaCoinButton(interaction);
      return;
    }
    if (customId.startsWith(`${PAYMENT_CONFIRMATION_PREFIX}:`)) {
      await PaymentConfirmationService.handleButton(interaction);
      return;
    }
    if (customId.startsWith(`${TICKET_EXCHANGE_PREFIX}:`)) {
      await handleTicketExchangeButton(interaction);
      return;
    }
    if (customId.startsWith(PRIVATE_HOTEL_PREFIX)) {
      await PrivateHotelService.handleButton(interaction);
      return;
    }
    if (customId.startsWith("rouletteBetStart_")) {
      const stage = Number(customId.split("_")[1]);
      if (stage !== 1 && stage !== 2 && stage !== 3) {
        throw new Error("ルーレットの部の情報が不正です。");
      }
      await RouletteService.showBetTypeSelect(interaction, stage);
      return;
    }
    if (customId.startsWith("rouletteConfirm_")) {
      await interaction.editReply({ content: await RouletteService.placeBet(interaction), embeds: [], components: [] });
      return;
    }
    if (customId === "rouletteCancel") {
      await interaction.editReply({ content: "ベットをキャンセルしました。", embeds: [], components: [] });
      return;
    }
    if (customId === CREATOR_EMBLEM_CANCEL_ID) {
      await interaction.editReply({ content: "支払いをキャンセルしました。", embeds: [], components: [] });
      return;
    }
    switch (customId) {
      case PANEL_COMMAND_NAMES.SEND:
        await showSelectUserMenu(
          interaction,
          PANEL_MESSAGES.SEND,
          PANEL_COMMAND_NAMES.SEND,
        );
        break;
      case PANEL_COMMAND_NAMES.SHOP_SEND:
        await showShopTicketSelectMenu(interaction);
        break;
      case PANEL_COMMAND_NAMES.COURT_SHOP_SEND:
        await showCourtShopAmountModal(interaction);
        break;
      case PANEL_COMMAND_NAMES.DARK_SHOP_SEND:
        await showDarkShopAmountModal(interaction);
        break;
      case PANEL_COMMAND_NAMES.CREATOR_EMBLEM_PAY:
        await CreatorEmblemPaymentService.showProductSelect(interaction);
        break;
      case PANEL_COMMAND_NAMES.SUPERCHAT_SEND:
        await SuperchatService.showStreamerSelect(interaction);
        break;
      case PANEL_COMMAND_NAMES.SHOP_TICKET_VIEW:
        await TicketViewService.viewTickets(interaction);
        break;
      case PANEL_COMMAND_NAMES.MARKET_GACHA_DRAW:
        await MarketGachaService.showPaymentSelection(interaction);
        break;
      case PANEL_COMMAND_NAMES.INVITE_POINT_GACHA_DRAW:
        await MarketGachaService.showDrawConfirmation(interaction, "invite_point");
        break;
      case PANEL_COMMAND_NAMES.MARKET_GACHA_PAYMENT_CURRENCY:
        await MarketGachaService.showDrawConfirmation(interaction, "currency");
        break;
      case PANEL_COMMAND_NAMES.MARKET_GACHA_PAYMENT_INVITE_POINT:
        await MarketGachaService.showDrawConfirmation(interaction, "invite_point");
        break;
      case PANEL_COMMAND_NAMES.MARKET_GACHA_CONFIRM_CURRENCY:
        await MarketGachaService.draw(interaction, "currency");
        break;
      case PANEL_COMMAND_NAMES.MARKET_GACHA_CONFIRM_INVITE_POINT:
        await MarketGachaService.draw(interaction, "invite_point");
        break;
      case PANEL_COMMAND_NAMES.MARKET_GACHA_CANCEL:
        await interaction.editReply({ content: "市場ガチャをキャンセルしました。", components: [] });
        break;
      case PANEL_COMMAND_NAMES.OMIKUJI_DRAW:
        await OmikujiService.draw(interaction);
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
      case PANEL_COMMAND_NAMES.TOGGLE_VC_LOCK_MARK:
        await VcService.toggleVcLockMark(interaction);
        break;
      case PANEL_COMMAND_NAMES.CHANGE_VC_STATUS:
        await VcService.validateVcMember(interaction);
        await showVcStatusModal(
          interaction,
          VC_MESSAGES.CHANGE_VC_STATUS,
          PANEL_COMMAND_NAMES.CHANGE_VC_STATUS,
        );
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL:
        if (
          await HotelVcService.isNormalHotelBonusMember(
            interaction.member as GuildMember,
          )
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
        // 現在は通貨支払いのみ。将来的にチケットを戻す場合は showStringSelectMenu を再利用する
        await showConfirmButton(
          interaction,
          PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL,
          HOTEL_PURCHASE_WAY_TYPE.MONEY,
        );
        break;
      case PANEL_COMMAND_NAMES.HOTEL_TICKET_VIEW:
      case PANEL_COMMAND_NAMES.GAME_TICKET_VIEW:
        await TicketViewService.viewTickets(interaction);
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_SECRET:
        await showSelectUserMenu(
          interaction,
          HOTEL_MESSAGES.SELECT_USER,
          PANEL_COMMAND_NAMES.HOTEL_VC_SECRET,
          (await HotelFreeTicketService.hasTicket(
            interaction.user.id,
            PANEL_COMMAND_NAMES.HOTEL_VC_SECRET,
          ))
            ? HOTEL_PURCHASE_WAY_TYPE.TICKET
            : HOTEL_PURCHASE_WAY_TYPE.MONEY,
        );
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG:
        // 現在は通貨支払いのみ。将来的にチケットを戻す場合は showStringSelectMenu を再利用する
        await showSelectUserMenu(
          interaction,
          HOTEL_MESSAGES.SELECT_USER,
          PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG,
          HOTEL_PURCHASE_WAY_TYPE.MONEY,
        );
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM:
        await showConfirmButton(
          interaction,
          PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM,
          (await HotelFreeTicketService.hasTicket(
            interaction.user.id,
            PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM,
          ))
            ? HOTEL_PURCHASE_WAY_TYPE.TICKET
            : HOTEL_PURCHASE_WAY_TYPE.MONEY,
        );
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOMLONG:
        // 現在は通貨支払いのみ。将来的にチケットを戻す場合は showStringSelectMenu を再利用する
        await showConfirmButton(
          interaction,
          PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOMLONG,
          HOTEL_PURCHASE_WAY_TYPE.MONEY,
        );
        break;
      case PANEL_COMMAND_NAMES.SOLITARY_CELL_CREATE:
        await SolitaryCellService.showConfirmation(interaction);
        break;
      case PANEL_COMMAND_NAMES.SOLITARY_CELL_CONFIRM:
        await SolitaryCellService.create(interaction);
        break;
      case PANEL_COMMAND_NAMES.SOLITARY_CELL_CANCEL:
        await SolitaryCellService.cancel(interaction);
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
          await showConfirmButton(
            interaction,
            customId,
            (await GameFreeTicketService.hasTicket(interaction.user.id, customId))
              ? "チケット"
              : HOTEL_PURCHASE_WAY_TYPE.MONEY,
          );
        }
        break;
      case PANEL_COMMAND_NAMES.GAME_PASS:
        await showConfirmButton(interaction, customId);
        break;
      case PANEL_COMMAND_NAMES.GAME_VC_CREATE:
        await GameVcService.showCreateConfirmation(interaction);
        break;
      case PANEL_COMMAND_NAMES.GAME_VC_CREATE_TICKET:
        await GameVcService.createVc(interaction, "ticket");
        break;
      case PANEL_COMMAND_NAMES.GAME_VC_CREATE_MONEY:
        await GameVcService.createVc(interaction, "money");
        break;
      case PANEL_COMMAND_NAMES.GAME_CRIMINAL_ACCESS_PURCHASE:
        await GameVcService.showCriminalAccessConfirmation(interaction);
        break;
      case PANEL_COMMAND_NAMES.GAME_CRIMINAL_ACCESS_CONFIRM:
        await GameVcService.purchaseCriminalAccess(interaction);
        break;
      case PANEL_COMMAND_NAMES.GAME_PASS_TWO_WEEKS:
        await GameVcService.showPassConfirmation(interaction, "twoWeeks");
        break;
      case PANEL_COMMAND_NAMES.GAME_PASS_ONE_MONTH:
        await GameVcService.showPassConfirmation(interaction, "oneMonth");
        break;
      case PANEL_COMMAND_NAMES.GAME_PASS_TWO_WEEKS_CONFIRM:
        await GameVcService.purchasePass(interaction, "twoWeeks");
        break;
      case PANEL_COMMAND_NAMES.GAME_PASS_ONE_MONTH_CONFIRM:
        await GameVcService.purchasePass(interaction, "oneMonth");
        break;
      case PANEL_COMMAND_NAMES.GAME_PASS_CANCEL:
        await interaction.editReply({
          content: "ゲームパスの購入をキャンセルしました。",
          embeds: [],
          components: [],
        });
        break;
      case PANEL_COMMAND_NAMES.HAZAMA_ACCESS:
        if (await HazamaService.isFree(interaction.member as GuildMember)) {
          await HazamaService.purchase(interaction);
        } else {
          await showConfirmButton(interaction, customId);
        }
        break;
      default:
        if (CreatorEmblemPaymentService.isConfirmCustomId(customId)) {
          await CreatorEmblemPaymentService.pay(interaction);
          break;
        }
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
          // 例: NORMAL_hotel_create_LIA_1234567890
          const parts = customId.split("_");
          const commandId = parts[0]; // NORMAL, SECRET, SECRETLONG, FREEDOM, FREEDOMLONG
          const selectedHotelPurchaseWay = parts[3]; // (LIA, チケット)
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
          // customId形式: {commandId}_game_confirm_{paymentWay}
          // 例: gameShort_game_confirm_チケット
          const parts = customId.split("_");
          const commandId = parts[0];
          const isExtend = commandId.endsWith("Extend"); // 延長購入かどうか
          const useTicket = parts[3] === "チケット";

          switch (commandId) {
            case PANEL_COMMAND_NAMES.GAME_SHORT:
            case PANEL_COMMAND_NAMES.GAME_LONG:
              await GameService.buyGameRole(
                interaction,
                commandId,
                isExtend,
                useTicket,
              );
              break;
            case PANEL_COMMAND_NAMES.GAME_PASS:
              await GameService.buyGamePass(interaction, commandId);
              break;
            default:
              throw new Error(PANEL_MESSAGES.BUTTON_NOT_FOUND);
          }
          break;
        } else if (customId === `${PANEL_COMMAND_NAMES.HAZAMA_ACCESS}_hazama_confirm`) {
          await HazamaService.purchase(interaction);
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
