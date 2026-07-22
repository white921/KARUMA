import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  TextChannel,
} from "discord.js";

import { getRoulettePanelChannelId } from "../constant/id";
import { ROULETTE_MESSAGES } from "../constant/roulette";
import { deletePanelMessage } from "../util/channelMessage";
import { RouletteStage } from "../type/roulette";

const STAGE_DESCRIPTIONS: Record<RouletteStage, string> = {
  1: "赤・黒・偶数・奇数から選んでベットできます。\n各ラウンド一人一賭け、確定後の変更はできません。",
  2: "赤・黒・偶数・奇数に加え、ダズン（1〜12／13〜24／25〜36）を選べます。\n各ラウンド一人一賭け、確定後の変更はできません。",
  3: "赤・黒・偶数・奇数・ダズンに加え、ストレートアップとスプリットを選べます。\nストレートアップ：数字を1つ指定（36倍）\nスプリット：異なる数字を2つ指定（18倍）\n各ラウンド一人一賭け、確定後の変更はできません。",
};

function getPanelChannelId(stage: RouletteStage): string {
  const channelId = getRoulettePanelChannelId(stage);
  if (!channelId) throw new Error(ROULETTE_MESSAGES.PANEL_NOT_CONFIGURED(stage));
  return channelId;
}

export class RoulettePanelService {
  static async createPanel(client: Client, stage: RouletteStage): Promise<void> {
    const channel = await client.channels.fetch(getPanelChannelId(stage));
    if (!channel || !channel.isTextBased()) {
      throw new Error(`ルーレット第${stage}部パネルのチャンネルが見つかりません。`);
    }

    const title = `ヨーロピアンルーレット 第${stage}部`;
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(`${STAGE_DESCRIPTIONS[stage]}\n\n運営が受付を開始している間だけベットできます。`)
      .setColor(0x0b7a3e);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`rouletteBetStart_${stage}`)
        .setLabel("賭けを開始する")
        .setStyle(ButtonStyle.Success),
    );

    await deletePanelMessage(channel as TextChannel, client, title);
    await (channel as TextChannel).send({ embeds: [embed], components: [row] });
  }
}
