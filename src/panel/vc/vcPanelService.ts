import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import { IN_CHAT_PANEL_MESSAGES } from "../../constant/panel/panel";
import { COLOR } from "../../constant/shared/color";
import { PANEL_COMMAND_NAMES } from "../../constant/shared/command";
import { HOTEL_VC_PANEL_MESSAGES } from "../../constant/panel/panel";
import { VC_MESSAGES } from "../../constant/vc/vc";

export class VcPanelService {
  /**
   * VC操作パネルを作成
   * @param limit 人数変更ボタンを表示するかどうか
   * @param name 名前変更ボタンを表示するかどうか
   * @param status ステータス変更ボタンを表示するかどうか
   * @param lockMark 名前の鍵マーク着脱ボタンを表示するかどうか
   * @returns パネルのEmbedとコンポーネント
   */
  static async createVcPanel(limit: boolean, name: boolean, status = false, lockMark = false) {
    try {
      if (!limit && !name && !status && !lockMark) {
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

      if (status) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(PANEL_COMMAND_NAMES.CHANGE_VC_STATUS)
            .setLabel(VC_MESSAGES.CHANGE_VC_STATUS)
            .setStyle(ButtonStyle.Primary),
        );
      }

      if (lockMark) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(PANEL_COMMAND_NAMES.TOGGLE_VC_LOCK_MARK)
            .setLabel("🔒付け外し")
            .setStyle(ButtonStyle.Success),
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

  static async createGameVcPanel(expiryText: string) {
    const panel = (await this.createVcPanel(false, true, true, true))!;
    panel.embeds[0]
      .setTitle("遊戯VC操作パネル")
      .setDescription(
        `有効期限: ${expiryText}\n期限になるとVCは削除されます。\n\n` +
        "VC内にいる方が操作できます。\n" +
        "🔒付け外しはVC名の先頭に🔒を付け外しします。接続権限は変わりません。",
      )
      .setThumbnail(null);
    return panel;
  }
}
