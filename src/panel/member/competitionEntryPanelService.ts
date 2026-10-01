import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
} from "discord.js";
import { COLOR } from "../../constant/shared/color";
import {
  COMPETITION_DISCIPLINES,
  COMPETITION_ENTRY_ACTIONS,
  COMPETITION_ENTRY_PANEL_CHANNEL_ID,
  COMPETITION_ENTRY_PANEL_TITLE,
  COMPETITION_ENTRY_PREFIX,
} from "../../constant/member/competitionEntry";

export function createCompetitionEntryPanelPayload() {
  const disciplines = Object.values(COMPETITION_DISCIPLINES)
    .map((discipline) => `・**${discipline.label}**`)
    .join("\n");
  return {
    content: "",
    embeds: [
      new EmbedBuilder()
        .setTitle(COMPETITION_ENTRY_PANEL_TITLE)
        .setColor(COLOR.COBALT_GREEN)
        .setDescription(disciplines),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(COMPETITION_ENTRY_ACTIONS.OPEN)
          .setLabel("回答・編集")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(COMPETITION_ENTRY_ACTIONS.REVIEW)
          .setLabel("回答確認")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    allowedMentions: { parse: [] as never[] },
  };
}

export class CompetitionEntryPanelService {
  static async createPanel(client: Client) {
    const channel = await client.channels.fetch(COMPETITION_ENTRY_PANEL_CHANNEL_ID);
    if (!channel || !channel.isThread() || !channel.isTextBased()) {
      throw new Error("競技エントリーパネルのスレッドが見つかりません。");
    }
    const messages = await channel.messages.fetch({ limit: 100 });
    const existing = messages.find(
      (message) =>
        message.author.id === client.user?.id &&
        (
          message.embeds.some(
            (embed) => embed.title === COMPETITION_ENTRY_PANEL_TITLE,
          ) ||
          message.components.some(
            (row) =>
              "components" in row &&
              row.components.some(
                (component) =>
                  "customId" in component &&
                  component.customId?.startsWith(`${COMPETITION_ENTRY_PREFIX}:`),
              ),
          )
        ),
    );
    if (existing) return existing.edit(createCompetitionEntryPanelPayload());
    return channel.send(createCompetitionEntryPanelPayload());
  }
}
