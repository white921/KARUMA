import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
} from "discord.js";
import { COLOR } from "../../constant/shared/color";
import {
  createTeamAssignmentCustomId,
  TEAM_ASSIGNMENT_PANEL_CHANNEL_ID,
  TEAM_ASSIGNMENT_PANEL_TITLE,
} from "../../constant/member/teamAssignment";

export function createTeamAssignmentPanelPayload() {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(TEAM_ASSIGNMENT_PANEL_TITLE)
        .setColor(COLOR.MAGENTA)
        .setDescription(
          "参加するチームのボタンを押し、表示される画面であいことばを入力してください。\n" +
          "あいことばが合っている場合、確認後にチームロールが付与されます。\n\n" +
          "※別のチームを選び直した場合は、現在のチームロールから切り替わります。",
        ),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(createTeamAssignmentCustomId("select", "red"))
          .setLabel("紅組")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(createTeamAssignmentCustomId("select", "blue"))
          .setLabel("蒼組")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
    allowedMentions: { parse: [] as never[] },
  };
}

export class TeamAssignmentPanelService {
  static async createPanel(client: Client) {
    const channel = await client.channels.fetch(TEAM_ASSIGNMENT_PANEL_CHANNEL_ID);
    if (!channel || !channel.isThread() || !channel.isTextBased()) {
      throw new Error("チーム分けパネルのスレッドが見つかりません。");
    }

    const messages = await channel.messages.fetch({ limit: 100 });
    const existing = messages.find(
      (message) =>
        message.author.id === client.user?.id &&
        message.embeds.some((embed) => embed.title === TEAM_ASSIGNMENT_PANEL_TITLE),
    );

    if (existing) return existing.edit(createTeamAssignmentPanelPayload());
    return channel.send(createTeamAssignmentPanelPayload());
  }
}
