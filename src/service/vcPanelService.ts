import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import { IN_CHAT_PANEL_MESSAGES } from "../constant/panel";
import { COLOR } from "../constant/color";
import { PANEL_COMMAND_NAMES } from "../constant/command";
import { HOTEL_VC_PANEL_MESSAGES } from "../constant/panel";

export class VcPanelService {
  /**
   * VC操作パネルを作成
   * @param limit 人数変更ボタンを表示するかどうか
   * @param name 名前変更ボタンを表示するかどうか
   * @returns パネルのEmbedとコンポーネント
   */
  static async createVcPanel(limit: boolean, name: boolean) {
    try {
      if (!limit && !name) {
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(IN_CHAT_PANEL_MESSAGES.TITLE)
        .setDescription(IN_CHAT_PANEL_MESSAGES.DESCRIPTION)
        .setColor(COLOR.MAGENTA)
        .setThumbnail(
          "https://cdn.discordapp.com/attachments/1434882309089132706/1440341250296512533/ChatGPT_Image_20251118_20_58_59.png?ex=691dcdd2&is=691c7c52&hm=54f9ed0bc5486c1aa1727e5584426ae021412249de0badec12ff90e2afbcd9cc&"
        );

      const buttons: ButtonBuilder[] = [];

      if (name) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(PANEL_COMMAND_NAMES.CHANGE_VC_NAME)
            .setLabel(HOTEL_VC_PANEL_MESSAGES.CHANGE_VC_NAME)
            .setStyle(ButtonStyle.Primary)
        );
      }

      // limitOnlyがfalseの場合のみVC名変更ボタンを追加
      if (limit) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(PANEL_COMMAND_NAMES.CHANGE_VC_LIMIT)
            .setLabel(HOTEL_VC_PANEL_MESSAGES.CHANGE_VC_LIMIT)
            .setStyle(ButtonStyle.Secondary)
        );
      }

      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

      return {
        embeds: [embed],
        components: [row1],
      };
    } catch (error) {
      throw error;
    }
  }
}
