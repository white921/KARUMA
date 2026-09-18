import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { getRoulettePanelChannelId } from "../../constant/shared/id";
import { ROULETTE_MESSAGES, STAGE_DESCRIPTIONS } from "../../constant/casino/roulette";
import type { RouletteStage } from "../../type/casino/roulette";
import { deletePanelMessage } from "../../util/shared/channelMessage";

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
