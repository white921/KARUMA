import {
  StringSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  EmbedBuilder,
  UserSelectMenuInteraction,
  GuildMember,
  ButtonInteraction,
  ModalSubmitInteraction,
} from "discord.js";

import { HotelVcService } from "../service/hotelVcService";
import { GameService } from "../service/gameService";

import { PANEL_COMMAND_NAMES } from "../constant/command";
import {
  HOTEL_MESSAGES,
  HOTEL_PRICE,
  HOTEL_PURCHASE_WAY_TYPE,
  HOTEL_TYPE_NAMES,
} from "../constant/hotel";
import { CURRENCY_NAMES } from "../constant/currency";
import { COLOR } from "../constant/color";
import { DIARY_MESSAGES, DIARY_PRICE, DIARY_TYPE } from "../constant/diary";

/**
 * 確認ボタンを表示（Embed + ボタン）
 * @param interaction インタラクション
 * @param commandId コマンドID (NORMAL, SECRET, SECRETLONG, FREEDOM, FREEDOMLONG, GAME_SHORT, GAME_LONG, GAME_SHORT_EXTEND, GAME_PASS, MINECRAFT_PASS)
 * @param selectedHotelPurchaseWay ホテル購入方法 (Royal, チケット)
 */
export async function showConfirmButton(
  interaction:
    | StringSelectMenuInteraction
    | UserSelectMenuInteraction
    | ButtonInteraction
    | ModalSubmitInteraction,
  commandId: string,
  selectedHotelPurchaseWay?: string,
) {
  try {
    const guild = interaction.guild;
    if (!guild) return;

    if (!selectedHotelPurchaseWay) {
      selectedHotelPurchaseWay = "undefined";
    }

    const selectedUserId =
      "isUserSelectMenu" in interaction && interaction.isUserSelectMenu()
        ? interaction.values[0]
        : null;

    const selectedMember = selectedUserId
      ? await guild?.members.fetch(selectedUserId)
      : null;
    const selectedMemberIconUrl = selectedMember
      ? selectedMember.displayAvatarURL({ extension: "png" })
      : null;

    let price: number;
    const embed = new EmbedBuilder();
    // ホテルとゲームで料金を取得
    if (commandId.startsWith("game")) {
      price = await GameService.getGamePrice(commandId);
    } else if (
      commandId === PANEL_COMMAND_NAMES.DIARY_PRIVATE ||
      commandId === PANEL_COMMAND_NAMES.DIARY_PUBLIC ||
      commandId === PANEL_COMMAND_NAMES.DIARY_UPDATE
    ) {
      price =
        commandId === PANEL_COMMAND_NAMES.DIARY_PRIVATE
          ? (DIARY_PRICE[DIARY_TYPE.PRIVATE] ?? 0)
          : commandId === PANEL_COMMAND_NAMES.DIARY_PUBLIC
            ? (DIARY_PRICE[DIARY_TYPE.PUBLIC] ?? 0)
            : (DIARY_PRICE[DIARY_TYPE.PUBLIC] ?? 0) -
              (DIARY_PRICE[DIARY_TYPE.PRIVATE] ?? 0);
    } else {
      price = await HotelVcService.getHotelVcPrice(
        commandId,
        interaction.member as GuildMember,
      );
    }
    switch (commandId) {
      case PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL:
        if (selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.MONEY) {
          embed.setTitle(`💰 ${HOTEL_TYPE_NAMES.NORMAL}`);
          embed.setDescription(
            `**${price}**${CURRENCY_NAMES}を消費して**${HOTEL_TYPE_NAMES.NORMAL}**を購入しますか？`,
          );
          embed.setColor(COLOR.YELLOW);
        } else if (
          selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.TICKET
        ) {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.NORMAL}`);
          embed.setDescription(
            `**${selectedHotelPurchaseWay}**を消費して**${HOTEL_TYPE_NAMES.NORMAL}**を購入しますか？`,
          );
          embed.setColor(COLOR.YELLOW);
        }
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_SECRET:
        if (selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.MONEY) {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.SECRET}`);
          embed.setDescription(
            `**${price}**${CURRENCY_NAMES}を消費して**${
              HOTEL_TYPE_NAMES.SECRET
            }**を購入しますか？\n選択したユーザー: <@${selectedUserId || ""}>`,
          );
          if (selectedMemberIconUrl) {
            embed.setImage(selectedMemberIconUrl);
          }
          embed.setColor(COLOR.YELLOW);
        } else if (
          selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.TICKET
        ) {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.SECRET}`);
          embed.setDescription(
            `**${selectedHotelPurchaseWay}**を消費して**${
              HOTEL_TYPE_NAMES.SECRET
            }**を購入しますか？\n選択したユーザー: <@${selectedUserId || ""}>\n${
              HOTEL_MESSAGES.TICKET_PRIORITY_NOTICE
            }`,
          );
          if (selectedMemberIconUrl) {
            embed.setImage(selectedMemberIconUrl);
          }
          embed.setColor(COLOR.YELLOW);
        } else if (selectedHotelPurchaseWay === "undefined") {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.SECRET}`);
          embed.setDescription(
            `**${
              HOTEL_TYPE_NAMES.SECRET
            }**を購入しますか？\n選択したユーザー: <@${selectedUserId || ""}>`,
          );
          embed.setImage(selectedMemberIconUrl);
          embed.setColor(COLOR.YELLOW);
        }
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG:
        if (selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.MONEY) {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.SECRETLONG}`);
          embed.setDescription(
            `**${price}**${CURRENCY_NAMES}を消費して**${
              HOTEL_TYPE_NAMES.SECRETLONG
            }**を購入しますか？\n選択したユーザー: <@${selectedUserId || ""}>`,
          );
          embed.setImage(selectedMemberIconUrl);
          embed.setColor(COLOR.YELLOW);
        }
        if (selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.TICKET) {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.SECRETLONG}`);
          embed.setDescription(
            `**${selectedHotelPurchaseWay}**を消費して**${
              HOTEL_TYPE_NAMES.SECRETLONG
            }**を購入しますか？\n選択したユーザー: <@${selectedUserId || ""}>`,
          );
          embed.setImage(selectedMemberIconUrl);
          embed.setColor(COLOR.YELLOW);
        }
        if (selectedHotelPurchaseWay === "undefined") {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.SECRETLONG}`);
          embed.setDescription(
            `**${price}**${CURRENCY_NAMES}を消費して**${
              HOTEL_TYPE_NAMES.SECRETLONG
            }**を購入しますか？\n選択したユーザー: <@${selectedUserId || ""}>`,
          );
          embed.setImage(selectedMemberIconUrl);
          embed.setColor(COLOR.YELLOW);
        }
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM:
        if (selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.MONEY) {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.FREEDOM}`);
          embed.setDescription(
            `**${price}**${CURRENCY_NAMES}を消費して**${HOTEL_TYPE_NAMES.FREEDOM}**を購入しますか？`,
          );
          embed.setColor(COLOR.YELLOW);
        } else if (
          selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.TICKET
        ) {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.FREEDOM}`);
          embed.setDescription(
            `**${selectedHotelPurchaseWay}**を消費して**${
              HOTEL_TYPE_NAMES.FREEDOM
            }**を購入しますか？\n${HOTEL_MESSAGES.TICKET_PRIORITY_NOTICE}`,
          );
          embed.setColor(COLOR.YELLOW);
        }
        break;
      case PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOMLONG:
        if (selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.MONEY) {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.FREEDOMLONG}`);
          embed.setDescription(
            `**${price}**${CURRENCY_NAMES}を消費して**${HOTEL_TYPE_NAMES.FREEDOMLONG}**を購入しますか？`,
          );
          embed.setColor(COLOR.YELLOW);
        } else if (
          selectedHotelPurchaseWay === HOTEL_PURCHASE_WAY_TYPE.TICKET
        ) {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.FREEDOMLONG}`);
          embed.setDescription(
            `**${selectedHotelPurchaseWay}**を消費して**${HOTEL_TYPE_NAMES.FREEDOMLONG}**を購入しますか？`,
          );
          embed.setColor(COLOR.YELLOW);
        } else if (selectedHotelPurchaseWay === "undefined") {
          embed.setTitle(`🏦 ${HOTEL_TYPE_NAMES.FREEDOMLONG}`);
          embed.setDescription(
            `**${HOTEL_TYPE_NAMES.FREEDOMLONG}**を購入しますか？`,
          );
          embed.setColor(COLOR.YELLOW);
        }
        break;
      // ゲーム関連のケース
      case PANEL_COMMAND_NAMES.GAME_SHORT:
      case PANEL_COMMAND_NAMES.GAME_LONG:
      case PANEL_COMMAND_NAMES.GAME_PASS: {
        const comment = await GameService.getGameComment(commandId);
        embed.setTitle(`🎮 ${comment}`);
        embed.setDescription(
          `**${price}**${CURRENCY_NAMES}を消費して**${comment}**を購入しますか？`,
          );
        embed.setColor(COLOR.GREEN);
        break;
      }
      case PANEL_COMMAND_NAMES.DIARY_PRIVATE:
        embed.setTitle(`📔 ${DIARY_MESSAGES.PRIVATE_CREATE}`);
        embed.setDescription(
          `**${price}**${CURRENCY_NAMES}を消費して**通常日記**を購入しますか？`,
        );
        embed.setColor(COLOR.PINK);
        break;
      case PANEL_COMMAND_NAMES.DIARY_PUBLIC:
        embed.setTitle(`📔 ${DIARY_MESSAGES.PUBLIC_CREATE}`);
        embed.setDescription(
          `**${price}**${CURRENCY_NAMES}を消費して**VIP日記**を購入しますか？`,
        );
        embed.setColor(COLOR.PINK);
        break;
      case PANEL_COMMAND_NAMES.DIARY_UPDATE:
        embed.setTitle(`📔 ${DIARY_MESSAGES.UPDATE}`);
        embed.setDescription(
          `**${price}**${CURRENCY_NAMES}を消費して**VIP日記へアップグレード**しますか？`,
        );
        embed.setColor(COLOR.PINK);
        break;
    }

    // キャンセルボタン
    const cancelButton = new ButtonBuilder()
      .setCustomId("cancel")
      .setLabel("キャンセル")
      .setStyle(ButtonStyle.Danger);

    // 確定ボタン
    const isGameCommand = commandId.startsWith("game");
    const isDiaryCommand =
      commandId === PANEL_COMMAND_NAMES.DIARY_PRIVATE ||
      commandId === PANEL_COMMAND_NAMES.DIARY_PUBLIC ||
      commandId === PANEL_COMMAND_NAMES.DIARY_UPDATE;

    const createButton = new ButtonBuilder()
      .setCustomId(
        isGameCommand
          ? `${commandId}_game_confirm`
          : isDiaryCommand
            ? `${commandId}_diary_confirm`
          : `${commandId}_hotel_create_${selectedHotelPurchaseWay}_${selectedUserId}`,
      )
      .setLabel("確定")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      cancelButton,
      createButton,
    );

    // ボタンを表示
    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: "Ephemeral" as any,
      });
    }
  } catch (error: any) {
    throw error;
  }
}
