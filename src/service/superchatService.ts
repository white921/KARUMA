import {
  ActionRowBuilder,
  ButtonInteraction,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from "discord.js";

import { PANEL_COMMAND_NAMES } from "../constant/command";
import { COLOR } from "../constant/color";
import { CURRENCY_NAMES } from "../constant/currency";
import {
  ROLE_IDS,
  SUPERCHAT_STREAMER_THREAD_IDS,
  SUPERCHAT_TEST_STREAMER_IDS,
  TEXT_CHANNEL_IDS,
} from "../constant/id";
import { SUPERCHAT_PANEL_MESSAGES } from "../constant/panel";
import { AccountService } from "./accountService";
import { ActionService } from "./actionService";
import { DbService } from "./dbService";
import { SendService } from "./sendService";

export type SuperchatStage = "singer" | "voice";

const STAGE_OPTIONS: Array<{ value: SuperchatStage; label: string }> = [
  { value: "singer", label: "歌冠ステージ" },
  { value: "voice", label: "声冠ステージ" },
];

export function canReceiveSuperchat(member: GuildMember): boolean {
  return SUPERCHAT_TEST_STREAMER_IDS.has(member.id) ||
    member.roles.cache.has(ROLE_IDS.STREAMER_MANAGER) ||
    member.roles.cache.has(ROLE_IDS.SINGER_CROWN) ||
    member.roles.cache.has(ROLE_IDS.VOICE_CROWN);
}

export function hasSuperchatThread(userId: string): boolean {
  return Boolean(SUPERCHAT_STREAMER_THREAD_IDS[userId]);
}

function isSuperchatStage(value: string): value is SuperchatStage {
  return value === "singer" || value === "voice";
}

function getStageChannelId(stage: SuperchatStage): string {
  return stage === "singer"
    ? TEXT_CHANNEL_IDS.SINGER_CROWN_STAGE
    : TEXT_CHANNEL_IDS.VOICE_CROWN_STAGE;
}

function getStageLabel(stage: SuperchatStage): string {
  return stage === "singer" ? "歌冠ステージ" : "声冠ステージ";
}

export class SuperchatService {
  static async showStreamerSelect(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) {
      throw new Error("この操作はサーバー内でのみ使用できます。");
    }

    const members = await interaction.guild.members.fetch();
    const streamers = members
      .filter((member) => !member.user.bot && canReceiveSuperchat(member) && hasSuperchatThread(member.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));
    if (streamers.size === 0) {
      throw new Error(SUPERCHAT_PANEL_MESSAGES.NO_STREAMER);
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(PANEL_COMMAND_NAMES.SUPERCHAT_STREAMER_SELECT)
      .setPlaceholder("送金先の配信者を選択してください")
      .addOptions(
        streamers.first(25).map((member) => ({
          label: member.displayName.slice(0, 100),
          value: member.id,
          description: "スパチャを送る配信者",
        })),
      );
    const embed = new EmbedBuilder()
      .setTitle("送金先を選択")
      .setDescription("スパチャを送る配信者を選択してください。")
      .setColor(COLOR.GREEN);

    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    });
  }

  static async showStageSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.guild) {
      throw new Error("この操作はサーバー内でのみ使用できます。");
    }

    const streamerId = interaction.values[0];
    const streamer = await interaction.guild.members.fetch(streamerId).catch(() => null);
    if (!streamer || !canReceiveSuperchat(streamer) || !hasSuperchatThread(streamerId)) {
      throw new Error(SUPERCHAT_PANEL_MESSAGES.INVALID_STREAMER);
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId(`${PANEL_COMMAND_NAMES.SUPERCHAT_STAGE_SELECT}:${streamerId}`)
      .setPlaceholder("送金先のステージを選択してください")
      .addOptions(STAGE_OPTIONS);
    const embed = new EmbedBuilder()
      .setTitle("ステージを選択")
      .setDescription(`<@${streamerId}> に送るスパチャのステージを選択してください。`)
      .setColor(COLOR.GREEN);

    await interaction.update({
      embeds: [embed],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    });
  }

  static async showAmountModal(interaction: StringSelectMenuInteraction): Promise<void> {
    const [, streamerId] = interaction.customId.split(":");
    const stage = interaction.values[0];
    if (!streamerId || !isSuperchatStage(stage)) {
      throw new Error(SUPERCHAT_PANEL_MESSAGES.INVALID_STAGE);
    }

    const modal = new ModalBuilder()
      .setCustomId(`${PANEL_COMMAND_NAMES.SUPERCHAT_SEND}:${streamerId}:${stage}`)
      .setTitle("スパチャを送る")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("amount")
            .setLabel(`送金額（${CURRENCY_NAMES}）`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("整数で入力してください")
            .setRequired(true)
            .setMaxLength(15),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("comment")
            .setLabel("コメント")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("配信者へのコメントを入力してください")
            .setRequired(false)
            .setMaxLength(1000),
        ),
      );

    await interaction.showModal(modal);
  }

  static createEmbed(
    sender: GuildMember,
    amount: number,
    comment: string,
    streamerId: string,
    stage: SuperchatStage,
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle("スパチャ")
      .setAuthor({
        name: sender.displayName,
        iconURL: sender.displayAvatarURL({ extension: "png" }),
      })
      .setDescription(comment || "コメントなし")
      .addFields(
        { name: "送金額", value: `${amount.toLocaleString()}${CURRENCY_NAMES}`, inline: true },
        { name: "配信者", value: `<@${streamerId}>`, inline: true },
        { name: "ステージ", value: getStageLabel(stage), inline: true },
      )
      .setColor(COLOR.LIGFT_PINK)
      .setTimestamp();
  }

  static async send(
    interaction: ModalSubmitInteraction,
    amount: number,
    comment: string,
  ): Promise<void> {
    if (!interaction.guild) {
      throw new Error("この操作はサーバー内でのみ使用できます。");
    }

    const [, streamerId, stageValue] = interaction.customId.split(":");
    if (!streamerId || !isSuperchatStage(stageValue)) {
      throw new Error(SUPERCHAT_PANEL_MESSAGES.INVALID_STAGE);
    }

    const [sender, streamer] = await Promise.all([
      interaction.guild.members.fetch(interaction.user.id),
      interaction.guild.members.fetch(streamerId).catch(() => null),
    ]);
    if (!streamer || !canReceiveSuperchat(streamer) || !hasSuperchatThread(streamerId)) {
      throw new Error(SUPERCHAT_PANEL_MESSAGES.INVALID_STREAMER);
    }

    const [fromAccount] = await AccountService.getAccountByUserId(sender.id);
    const [toAccount] = await AccountService.getAccountByUserId(streamerId);
    await SendService.validateSend(fromAccount, toAccount, amount);

    const stageChannel = await interaction.client.channels.fetch(getStageChannelId(stageValue));
    const thread = await interaction.client.channels.fetch(SUPERCHAT_STREAMER_THREAD_IDS[streamerId]);
    if (!stageChannel || !stageChannel.isTextBased() || stageChannel.isThread()) {
      throw new Error("スパチャ送信先のステージチャンネルが見つかりません。");
    }
    if (!thread || !thread.isThread() || !thread.isTextBased()) {
      throw new Error("スパチャログ用スレッドが見つかりません。");
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const fromAfterWallet = fromAccount.wallet - amount;
    const toAfterWallet = toAccount.wallet + amount;
    const connection = await DbService.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [fromAfterWallet, sender.id]);
      await connection.execute("UPDATE accounts SET wallet = ? WHERE user_id = ?", [toAfterWallet, streamerId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    await ActionService.executeActionLog(
      interaction,
      PANEL_COMMAND_NAMES.SUPERCHAT_SEND,
      amount,
      sender.id,
      streamerId,
      fromAfterWallet,
      toAfterWallet,
      comment,
    );

    const embed = this.createEmbed(sender, amount, comment, streamerId, stageValue);
    await (stageChannel as TextChannel).send({ embeds: [embed] });
    await (thread as ThreadChannel).send({ embeds: [embed] });

    await interaction.editReply({
      content: `<@${streamerId}> に ${amount.toLocaleString()}${CURRENCY_NAMES} のスパチャを送りました。`,
      components: [],
    });
  }
}
