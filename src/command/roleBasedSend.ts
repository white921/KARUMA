import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { RoleBasedSendService } from "../service/roleBasedSendService";

import { COMMAND_NAMES } from "../constant/command";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.ROLE_BASED_SEND)
  .setDescription("指定ロールを持つユーザーに一括送金します")
  .addRoleOption((option) =>
    option
      .setName("role")
      .setDescription("送金対象のロール")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("amount")
      .setDescription("1人あたりの送金額")
      .setMinValue(1)
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("comment")
      .setDescription("備考")
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const selectedRole = interaction.options.getRole("role", true);
  const amount = interaction.options.getInteger("amount", true);
  const comment = interaction.options.getString("comment") || "";

  const targetRole =
    (await interaction.guild?.roles.fetch(selectedRole.id).catch(() => null)) ??
    null;

  await RoleBasedSendService.execute(
    interaction,
    targetRole,
    amount,
    comment,
  );
}
