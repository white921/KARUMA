import { ActionRowBuilder, ChannelType, Client, EmbedBuilder, StringSelectMenuBuilder } from "discord.js";
import { MEETING_PANEL_CHANNEL_ID, MEETING_SELECT_ID, MEETING_TEMPLATES } from "../../constant/vc/meeting";
import { COLOR } from "../../constant/shared/color";

export function createMeetingPanel() {
  return {
    embeds: [new EmbedBuilder()
      .setTitle("会議VC作成パネル")
      .setDescription(
        "始めたい会議のカテゴリーを選ぶと、会議VCを無料で作成できます。\n\n" +
        "接続・作成できるのは、そのカテゴリーの従業員・統括などの関係者です。\n" +
        "その他の方もVCを閲覧できます。\n" +
        "全員が退出すると自動で削除されます。作成後は5分以内に入室してください。",
      )
      .setColor(COLOR.MAGENTA)],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(MEETING_SELECT_ID)
        .setPlaceholder("会議のカテゴリーを選択")
        .addOptions(MEETING_TEMPLATES.map(({ id, label }) => ({ label: `${label}会議`, value: id }))),
    )],
    allowedMentions: { parse: [] as never[] },
  };
}

export class MeetingPanelService {
  static async createPanel(client: Client) {
    const channel = await client.channels.fetch(MEETING_PANEL_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error("会議VC作成パネルのチャンネルが見つかりません。");
    }
    const messages = await channel.messages.fetch({ limit: 100 });
    const existing = messages.find(message => message.author.id === client.user?.id &&
      message.components.some(row => row.type === 1 && row.components.some(component => component.customId === MEETING_SELECT_ID)));
    if (existing) return existing.edit(createMeetingPanel());
    return channel.send(createMeetingPanel());
  }
}
