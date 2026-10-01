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
    .map((discipline) => `・**${discipline.label}**：${discipline.capacity}`)
    .join("\n");
  return {
    content:
      "双璧戦の出場種目を決めるため、競技エントリーを行います。\n" +
      "下のパネルから、各競技の出場可否・現在のランク・ゲーム内ネーム・IDなどを回答してください。\n\n" +
      "回答は後から何度でも編集できます。未定の項目は空欄でも構いませんので、まずは出場可否だけでも回答をお願いします。\n\n" +
      "※回答した時点では出場確定ではありません。回答内容をもとに、各チームの大将・副大将が出場メンバーを調整します。",
    embeds: [
      new EmbedBuilder()
        .setTitle(COMPETITION_ENTRY_PANEL_TITLE)
        .setColor(COLOR.COBALT_GREEN)
        .setDescription(
          "双璧戦で参加できる競技を回答してください。\n" +
          "ランクがある競技は現在のランク、ゲーム内ネーム、IDも入力できます。\n" +
          "未定の場合は出場可否だけでも保存でき、回答は後から何度でも編集できます。\n\n" +
          `${disciplines}\n\n` +
          "※人数は各組の目安です。回答した時点では出場確定ではありません。",
        ),
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
