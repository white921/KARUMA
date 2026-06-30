import {
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  SlashCommandBuilder,
  User,
} from "discord.js";

import { EvaluationService } from "../service/evaluationService";
import { COMMAND_NAMES } from "../constant/command";
import { EVALUATION_SHEET_MESSAGES } from "../constant/evaluationSheet";
import { ROLE_IDS } from "../constant/id";

const ALLOWED_ROLE_IDS = [
  ROLE_IDS.EVALUATION_LEADER,
  ROLE_IDS.SIKKOKAN,
  ROLE_IDS.SOUZOUSYU,
  ROLE_IDS.GIJUTU_LEADER,
  ROLE_IDS.GIJUTUSYA,
];

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.EXTRA_EXTEND)
  .setDescription("評価シートの期間を延長します")
  .addIntegerOption((option) =>
    option
      .setName("days")
      .setDescription("延長日数")
      .setMinValue(1)
      .setRequired(true),
  )
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("指定した場合はそのユーザーのシートだけ延長します")
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("reason")
      .setDescription("延長理由 (各スレッドのログに記載されます)")
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const operator = interaction.member as GuildMember;
  const days = interaction.options.getInteger("days", true);
  const targetUser = interaction.options.getUser("user") as User | null;
  const reason = interaction.options.getString("reason");
  const targetMember = targetUser
    ? await interaction.guild?.members.fetch(targetUser.id)
    : null;

  const allowed = ALLOWED_ROLE_IDS.some((id) => operator.roles.cache.has(id));
  if (!allowed) {
    throw new Error(EVALUATION_SHEET_MESSAGES.EXTEND_NO_PERMISSION);
  }

  const { extendedCount, skipped, failed } =
    await EvaluationService.extendAllEvaluationSheets(
      interaction.client,
      days,
      operator.id,
      { targetMember, reason },
    );

  const scope = targetMember ? `<@${targetMember.id}> の` : "";
  const summary =
    extendedCount === 0 && failed.length === 0
      ? `${EVALUATION_SHEET_MESSAGES.EXTEND_NO_TARGET}${
          targetMember ? ` (対象: <@${targetMember.id}>)` : ""
        }`
      : `✅ ${scope}評価シート ${extendedCount}件 の期間を ${days}日 延長しました。`;
  const sections: string[] = [summary];

  if (failed.length > 0) {
    const lines = failed.map((f) =>
      f.url
        ? `- [${f.thread}](${f.url}): ${f.reason}`
        : `- ${f.thread}: ${f.reason}`,
    );
    sections.push(`❌ 失敗 ${failed.length}件\n${lines.join("\n")}`);
  }

  if (skipped.length > 0) {
    const lines = skipped.map((s) => `- ${s.thread}: ${s.reason}`);
    sections.push(`⚠️ スキップ ${skipped.length}件\n${lines.join("\n")}`);
  }

  const content = sections.join("\n\n");
  if (content.length <= 2000) {
    await interaction.editReply({ content });
    return;
  }

  await interaction.editReply({
    content: sections[0] + `\n\n（詳細レポートを分割送信します）`,
  });
  for (let i = 1; i < sections.length; i++) {
    await interaction.followUp({
      content: sections[i].slice(0, 2000),
      flags: MessageFlags.Ephemeral,
    });
  }
}
