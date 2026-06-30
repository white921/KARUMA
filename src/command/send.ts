import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { SendService } from "../service/sendService";

import { COMMAND_NAMES } from "../constant/command";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.SEND)
  .setDescription("指定ユーザーに送金します")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("送金先ユーザー")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("amount")
      .setDescription("送金額")
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
  try {
    const toUser = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);
    const comment = interaction.options.getString("comment") || "";

    await SendService.sendByCommand(
      interaction,
      interaction.user.id,
      toUser.id,
      amount,
      comment,
    );
  } catch (error) {
    throw error;
  }
}
