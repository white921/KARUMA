import {
  ActionRowBuilder,
  ButtonInteraction,
  EmbedBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

import { AccountService } from "../service/accountService";

import { COLOR } from "../constant/color";
import { SELECT_MESSAGES } from "../constant/select";
import { HOTEL_PURCHASE_WAY_TYPE } from "../constant/hotel";

/**
 * ユーザー選択メニューを表示
 * @param interaction
 * @param commandDescription
 * @param commandId (send, adminView, adminMint, adminBurn, SECRET, casinoGf, casinoMajong, casinoOther)
 * @returns
 */
export async function showSelectUserMenu(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  commandDescription: string,
  commandId: string,
  selectedHotelPurchaseWay?: string,
) {
  try {
    const guild = interaction.guild;
    if (!guild) return;

    // 将来的にホテル購入方法の選択UIを戻す場合は、StringSelectから値を受け取れるよう残しておく
    const hotelPurchaseWay =
      selectedHotelPurchaseWay ??
      (interaction.isStringSelectMenu()
        ? interaction.values[0] // (Royal, チケット)
        : undefined);
    const customId = hotelPurchaseWay
      ? `${commandId}_user_select_${hotelPurchaseWay}`
      : `${commandId}_user_select`;

    const userSelectMenu = new UserSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(`ユーザーを選択してください`)
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      userSelectMenu
    );

    const embed = new EmbedBuilder()
      .setTitle(`🏦 ${commandDescription}`)
      .setDescription(`${commandDescription}するユーザーを選択してください`)
      .setColor(COLOR.GREEN);

    if (interaction.deferred) {
      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
    }
  } catch (error: any) {
    throw error;
  }
}

/**
 * ユーザー選択メニューのバリデーション
 * @param interaction
 */
export async function validateSelectUserMenu(
  interaction: UserSelectMenuInteraction
) {
  try {
    const toUserId = interaction.values[0];

    // 選択したユーザーが存在しない
    if (!(await AccountService.hasAccount(toUserId))) {
      throw new Error(SELECT_MESSAGES.NOT_FOUND_USER);
    }
  } catch (error: any) {
    throw error;
  }
}

/**
 * ホテル購入方法選択メニューを表示
 * @param interaction
 * @returns
 */
export async function showStringSelectMenu(
  interaction: ButtonInteraction,
  canUseFreeTicket = false,
) {
  try {
    const guild = interaction.guild;
    if (!guild) return;

    const commandId = interaction.customId; // NORMAL, SECRET, FREEDOM, FREEDOM-LONG

    const hotelPurchaseWaySelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`${commandId}_hotel_purchase_way_select`)
      .setPlaceholder(`ホテル購入方法を選択してください`)
      .addOptions([
        {
          label: HOTEL_PURCHASE_WAY_TYPE.MONEY,
          value: HOTEL_PURCHASE_WAY_TYPE.MONEY,
        },
        ...(canUseFreeTicket
          ? [{ label: HOTEL_PURCHASE_WAY_TYPE.TICKET, value: HOTEL_PURCHASE_WAY_TYPE.TICKET }]
          : []),
      ])
      .setMinValues(1)
      .setMaxValues(1);

    const embed = new EmbedBuilder()
      .setTitle(`🏦 ホテル購入方法を選択してください。`)
      .setDescription(
        `${HOTEL_PURCHASE_WAY_TYPE.MONEY}か${HOTEL_PURCHASE_WAY_TYPE.TICKET}のいずれかを選択してください。`
      )
      .setColor(COLOR.GREEN);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      hotelPurchaseWaySelectMenu
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  } catch (error: any) {
    throw error;
  }
}

/**
 * VCの制限人数選択メニューを表示
 * @param interaction
 * @returns
 */
export async function showSelectNumberMenu(interaction: ButtonInteraction) {
  try {
    const guild = interaction.guild;
    if (!guild) return;

    const numberSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`change_vc_limit_select`)
      .setPlaceholder(`人数を選択してください`)
      .addOptions(
        {
          label: "1人",
          value: "1",
        },
        {
          label: "2人",
          value: "2",
        },
        {
          label: "3人",
          value: "3",
        },
        {
          label: "無制限",
          value: "0",
        }
      );

    const embed = new EmbedBuilder()
      .setTitle(`VCの制限人数を変更`)
      .setDescription(`VCの制限人数を選択してください。`)
      .setColor(COLOR.GREEN);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      numberSelectMenu
    );
    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  } catch (error: any) {
    throw error;
  }
}
