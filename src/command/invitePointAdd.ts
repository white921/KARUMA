import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { InvitePointService } from "../service/invitePointService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.INVITE_POINT_ADD)
  .setDescription("ユーザーに招待ポイントを追加します")
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName("ユーザー")
      .setDescription("ポイントを追加するユーザー")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("ポイント")
      .setDescription("追加する招待ポイント")
      .setMinValue(1)
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await InvitePointService.assertOperator(interaction);
  const targetUser = interaction.options.getUser("ユーザー", true);
  const amount = interaction.options.getInteger("ポイント", true);
  const afterPoints = await InvitePointService.grant(
    targetUser.id,
    amount,
    interaction.user.id,
  );

  await interaction.editReply({
    content: `✅ <@${targetUser.id}> に招待ポイントを ${amount}pt 追加しました。現在の招待ポイント: ${afterPoints}pt`,
  });
}
