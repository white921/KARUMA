import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
} from "discord.js";

import { deletePanelMessage } from "../util/channelMessage";

import { TEXT_CHANNEL_IDS } from "../constant/id";
import { HOTEL_VC_PANEL_MESSAGES } from "../constant/panel";
import { HOTEL_TYPE_NAMES } from "../constant/hotel";
import { PANEL_MESSAGES } from "../constant/panel";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";

export function createHotelVcPanelActionRows() {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL)
      .setLabel(HOTEL_TYPE_NAMES.NORMAL)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.HOTEL_VC_SECRET)
      .setLabel(HOTEL_TYPE_NAMES.SECRET)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG)
      .setLabel(HOTEL_TYPE_NAMES.SECRETLONG)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM)
      .setLabel(HOTEL_TYPE_NAMES.FREEDOM)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOMLONG)
      .setLabel(HOTEL_TYPE_NAMES.FREEDOMLONG)
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.VIEW)
      .setLabel(PANEL_MESSAGES.VIEW)
      .setStyle(ButtonStyle.Primary)
  );

  return [row1, row2];
}

export class HotelVcPanelService {
  /**
   * ホテルVCパネルを作成
   * 1つのチャンネルで通常ホテルと特殊ホテルをまとめて案内する
   * @param client クライアント
   */
  static async createHotelVcPanel(client: Client) {
    try {
      const channel = await client.channels.fetch(
        TEXT_CHANNEL_IDS.NORMAL_HOTEL_VC_PANEL
      );

      if (!channel || channel.type !== ChannelType.GuildText) {
        console.error(HOTEL_VC_PANEL_MESSAGES.ERROR);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(HOTEL_VC_PANEL_MESSAGES.TITLE)
        .setDescription(HOTEL_VC_PANEL_MESSAGES.DESCRIPTION)
        .setColor(COLOR.MAGENTA)
        .setThumbnail(
          "https://cdn.discordapp.com/attachments/1434882309089132706/1440341250296512533/ChatGPT_Image_20251118_20_58_59.png?ex=691dcdd2&is=691c7c52&hm=54f9ed0bc5486c1aa1727e5584426ae021412249de0badec12ff90e2afbcd9cc&"
        );

      const [row1, row2] = createHotelVcPanelActionRows();

      await deletePanelMessage(channel, client, HOTEL_VC_PANEL_MESSAGES.TITLE);

      await channel.send({
        embeds: [embed],
        components: [row1, row2],
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 通常ホテルパネルを作成
   * 聖書の館ボタン(通常ホテル)
   * 残高確認ボタン
   * @param client クライアント
   */
  static async createNormalHotelVcPanel(client: Client) {
    try {
      const channel = await client.channels.fetch(
        TEXT_CHANNEL_IDS.NORMAL_HOTEL_VC_PANEL
      );

      if (!channel || channel.type !== ChannelType.GuildText) {
        console.error(HOTEL_VC_PANEL_MESSAGES.ERROR);
        return;
      }

      // パネルメッセージを作成
      const embed = new EmbedBuilder()
        .setTitle(HOTEL_VC_PANEL_MESSAGES.TITLE)
        .setDescription(HOTEL_VC_PANEL_MESSAGES.NORMAL_DESCRIPTION)
        .setColor(COLOR.MAGENTA)
        .setThumbnail(
          "https://cdn.discordapp.com/attachments/1434882309089132706/1440341250296512533/ChatGPT_Image_20251118_20_58_59.png?ex=691dcdd2&is=691c7c52&hm=54f9ed0bc5486c1aa1727e5584426ae021412249de0badec12ff90e2afbcd9cc&"
        );
      // コマンドボタンを作成
      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.HOTEL_VC_NORMAL)
          .setLabel(HOTEL_TYPE_NAMES.NORMAL)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.VIEW)
          .setLabel(PANEL_MESSAGES.VIEW)
          .setStyle(ButtonStyle.Primary)
      );

      await deletePanelMessage(channel, client, HOTEL_VC_PANEL_MESSAGES.TITLE);

      // 新しい管理者パネルメッセージを送信
      await channel.send({
        embeds: [embed],
        components: [row1],
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 特殊ホテルパネルを作成
   * VIPホテル (12時間)ボタン
   * VIPホテル (24時間)ボタン
   * フリーダム (12時間)ボタン
   * フリーダム (24時間)ボタン
   * 残高確認ボタン
   * @param client クライアント
   */
  static async createSpecialHotelVcPanel(client: Client) {
    try {
      const channel = await client.channels.fetch(
        TEXT_CHANNEL_IDS.SPECIAL_HOTEL_VC_PANEL
      );

      if (!channel || channel.type !== ChannelType.GuildText) {
        console.error(HOTEL_VC_PANEL_MESSAGES.ERROR);
        return;
      }

      // パネルメッセージを作成
      const embed = new EmbedBuilder()
        .setTitle(HOTEL_VC_PANEL_MESSAGES.TITLE)
        .setDescription(HOTEL_VC_PANEL_MESSAGES.SPECIAL_DISCRIPTION)
        .setColor(COLOR.MAGENTA)
        .setThumbnail(
          "https://cdn.discordapp.com/attachments/1434882309089132706/1440341250296512533/ChatGPT_Image_20251118_20_58_59.png?ex=691dcdd2&is=691c7c52&hm=54f9ed0bc5486c1aa1727e5584426ae021412249de0badec12ff90e2afbcd9cc&"
        );
      // コマンドボタンを作成
      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.HOTEL_VC_SECRET)
          .setLabel(HOTEL_TYPE_NAMES.SECRET)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.HOTEL_VC_SECRETLONG)
          .setLabel(HOTEL_TYPE_NAMES.SECRETLONG)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOM)
          .setLabel(HOTEL_TYPE_NAMES.FREEDOM)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.HOTEL_VC_FREEDOMLONG)
          .setLabel(HOTEL_TYPE_NAMES.FREEDOMLONG)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(PANEL_COMMAND_NAMES.VIEW)
          .setLabel(PANEL_MESSAGES.VIEW)
          .setStyle(ButtonStyle.Primary)
      );

      await deletePanelMessage(channel, client, HOTEL_VC_PANEL_MESSAGES.TITLE);

      // 新しい管理者パネルメッセージを送信
      await channel.send({
        embeds: [embed],
        components: [row1],
      });
    } catch (error) {
      throw error;
    }
  }
}
