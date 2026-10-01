import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { COLOR } from "../../constant/shared/color";
import {
  createTeamAssignmentCustomId,
  isTeamAssignmentKey,
  TEAM_ASSIGNMENT_CONFIRMATION_TTL_MS,
  TEAM_ASSIGNMENT_PANEL_CHANNEL_ID,
  TEAM_ASSIGNMENT_PASSPHRASE_INPUT_ID,
  TEAM_ASSIGNMENT_PREFIX,
  TEAM_ASSIGNMENTS,
  type TeamAssignmentKey,
} from "../../constant/member/teamAssignment";

type TeamRoleHolder = {
  roles: { cache: { has(roleId: string): boolean } };
};

type TeamAssignmentConfirmation = {
  id: string;
  userId: string;
  guildId: string;
  channelId: string;
  team: TeamAssignmentKey;
  expiresAt: number;
};

function parseTeamCustomId(
  customId: string,
  expectedAction: "select" | "modal",
): TeamAssignmentKey {
  const [prefix, action, team, extra] = customId.split(":");
  if (
    prefix !== TEAM_ASSIGNMENT_PREFIX ||
    action !== expectedAction ||
    extra !== undefined ||
    !isTeamAssignmentKey(team)
  ) {
    throw new Error("チームの選択情報が不正です。パネルからやり直してください。");
  }
  return team;
}

function confirmationButtonId(
  action: "confirm" | "cancel",
  confirmationId: string,
): string {
  return `${TEAM_ASSIGNMENT_PREFIX}:${action}:${confirmationId}`;
}

function hasTeamRole(member: TeamRoleHolder): boolean {
  return (
    member.roles.cache.has(TEAM_ASSIGNMENTS.red.roleId) ||
    member.roles.cache.has(TEAM_ASSIGNMENTS.blue.roleId)
  );
}

async function fetchEligibleMember(
  interaction: ButtonInteraction | ModalSubmitInteraction,
) {
  if (!interaction.guild) {
    throw new Error("サーバー情報を取得できませんでした。パネルからやり直してください。");
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (hasTeamRole(member)) {
    throw new Error("すでにチームが決まっているため、別のチームへ変更できません。");
  }
  return member;
}

export class TeamAssignmentService {
  static readonly confirmations = new Map<string, TeamAssignmentConfirmation>();

  static isSelectButton(customId: string): boolean {
    return customId.startsWith(`${TEAM_ASSIGNMENT_PREFIX}:select:`);
  }

  static isConfirmationButton(customId: string): boolean {
    return (
      customId.startsWith(`${TEAM_ASSIGNMENT_PREFIX}:confirm:`) ||
      customId.startsWith(`${TEAM_ASSIGNMENT_PREFIX}:cancel:`)
    );
  }

  static async showPassphraseModal(interaction: ButtonInteraction): Promise<void> {
    if (interaction.channelId !== TEAM_ASSIGNMENT_PANEL_CHANNEL_ID) {
      throw new Error("この操作はチーム分けパネルでのみ利用できます。");
    }
    await fetchEligibleMember(interaction);
    const team = parseTeamCustomId(interaction.customId, "select");
    const assignment = TEAM_ASSIGNMENTS[team];
    const input = new TextInputBuilder()
      .setCustomId(TEAM_ASSIGNMENT_PASSPHRASE_INPUT_ID)
      .setLabel("あいことば")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(32);

    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(createTeamAssignmentCustomId("modal", team))
        .setTitle(`${assignment.label}のあいことば`)
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input)),
    );
  }

  static async submitPassphrase(
    interaction: ModalSubmitInteraction,
  ): Promise<void> {
    const team = parseTeamCustomId(interaction.customId, "modal");
    const assignment = TEAM_ASSIGNMENTS[team];
    const submitted = interaction.fields
      .getTextInputValue(TEAM_ASSIGNMENT_PASSPHRASE_INPUT_ID)
      .normalize("NFC")
      .trim();

    if (submitted !== assignment.passphrase) {
      await interaction.reply({
        content: "あいことばが違います。もう一度パネルからお試しください。",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (
      !interaction.guildId ||
      interaction.channelId !== TEAM_ASSIGNMENT_PANEL_CHANNEL_ID
    ) {
      throw new Error("この操作はサーバー内のチーム分けパネルでのみ利用できます。");
    }
    await fetchEligibleMember(interaction);

    const now = Date.now();
    for (const [id, confirmation] of this.confirmations) {
      if (confirmation.expiresAt <= now || confirmation.userId === interaction.user.id) {
        this.confirmations.delete(id);
      }
    }

    const confirmation: TeamAssignmentConfirmation = {
      id: randomUUID(),
      userId: interaction.user.id,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      team,
      expiresAt: now + TEAM_ASSIGNMENT_CONFIRMATION_TTL_MS,
    };
    this.confirmations.set(confirmation.id, confirmation);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("チーム参加の確認")
          .setColor(team === "red" ? COLOR.RED : COLOR.BLUE)
          .setDescription(
            `**${assignment.label}**に参加します。\n` +
            "確定すると選択したチームのロールが付与されます。\n" +
            "一度確定すると、別のチームへ変更できません。\n\n" +
            "よろしいですか？",
          ),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(confirmationButtonId("confirm", confirmation.id))
            .setLabel("確定する")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(confirmationButtonId("cancel", confirmation.id))
            .setLabel("キャンセル")
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }

  static async handleConfirmation(interaction: ButtonInteraction): Promise<void> {
    const [prefix, action, confirmationId, extra] = interaction.customId.split(":");
    if (
      prefix !== TEAM_ASSIGNMENT_PREFIX ||
      (action !== "confirm" && action !== "cancel") ||
      !confirmationId ||
      extra !== undefined
    ) {
      throw new Error("確認情報が不正です。パネルからやり直してください。");
    }

    const confirmation = this.confirmations.get(confirmationId);
    if (
      !confirmation ||
      confirmation.expiresAt <= Date.now() ||
      confirmation.userId !== interaction.user.id ||
      confirmation.guildId !== interaction.guildId ||
      confirmation.channelId !== interaction.channelId
    ) {
      if (confirmation?.expiresAt && confirmation.expiresAt <= Date.now()) {
        this.confirmations.delete(confirmationId);
      }
      throw new Error("この確認は期限切れです。パネルからやり直してください。");
    }

    this.confirmations.delete(confirmationId);
    if (action === "cancel") {
      await interaction.editReply({
        content: "チームへの参加をキャンセルしました。",
        embeds: [],
        components: [],
      });
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      throw new Error("サーバー情報を取得できませんでした。パネルからやり直してください。");
    }
    const assignment = TEAM_ASSIGNMENTS[confirmation.team];
    const [member, targetRole] = await Promise.all([
      guild.members.fetch({ user: interaction.user.id, force: true }),
      guild.roles.fetch(assignment.roleId),
    ]);
    if (hasTeamRole(member)) {
      await interaction.editReply({
        content: "すでにチームが決まっているため、別のチームへ変更できません。",
        embeds: [],
        components: [],
      });
      return;
    }
    if (!targetRole) {
      throw new Error("チームロールが見つかりません。運営へご連絡ください。");
    }
    if (!targetRole.editable) {
      throw new Error("チームロールを変更できません。運営へご連絡ください。");
    }

    await member.roles.add(targetRole, `対抗戦チーム分けパネル: ${assignment.label}`);

    await interaction.editReply({
      content: `✅ ${assignment.label}に参加しました。`,
      embeds: [],
      components: [],
      allowedMentions: { parse: [] },
    });
  }
}
