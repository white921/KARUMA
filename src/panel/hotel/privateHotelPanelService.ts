import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder } from "discord.js";
import { PRIVATE_HOTEL_PREFIX, PRIVATE_HOTEL_TITLE } from "../../constant/hotel/privateHotel";
import { HOTEL_VC_PANEL_MESSAGES } from "../../constant/panel/panel";
import { TEXT_CHANNEL_IDS } from "../../constant/shared/id";
import { COLOR } from "../../constant/shared/color";
import { deletePanelMessage } from "../../util/shared/channelMessage";

export function createPrivateHotelPanelPayload() {
  return {
    embeds: [new EmbedBuilder()
      .setTitle(PRIVATE_HOTEL_TITLE)
      .setColor(COLOR.MAGENTA)
      .setDescription(HOTEL_VC_PANEL_MESSAGES.SPECIAL_DISCRIPTION.trim() +
        "\n\n種類を選んだ後に、12時間／24時間を選択できます。\n" +
        "対象の12時間用チケットを必要枚数お持ちの場合、優先して消費します。\n" +
        "12時間：1枚 ／ 24時間：2枚\n必要枚数に満たない場合は、チケットを消費せずLIAで購入します。")],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${PRIVATE_HOTEL_PREFIX}vip`).setLabel("VIPホテル").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${PRIVATE_HOTEL_PREFIX}freedom`).setLabel("フリーダムホテル").setStyle(ButtonStyle.Primary),
    )],
  };
}

export class PrivateHotelPanelService {
  /** 公開時に移転先で /panel を実行する。起動時には投稿しない。 */
  static async createPanel(client: Client) {
    const channel = await client.channels.fetch(TEXT_CHANNEL_IDS.PRIVATE_HOTEL_PANEL);
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error("新ホテルパネルのチャンネルが見つかりません。");
    await deletePanelMessage(channel, client, PRIVATE_HOTEL_TITLE);
    await channel.send(createPrivateHotelPanelPayload());
  }
}
