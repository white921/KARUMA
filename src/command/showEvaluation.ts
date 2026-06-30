import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { COMMAND_MESSAGES, COMMAND_NAMES } from "../constant/command";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.SHOW_EVALUATION)
  .setDescription("特定のユーザーの評価期間を表示します")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("評価期間を表示するユーザー")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // 現在Aetherでは評価DBを使っていないため停止中。
  // TODO: evaluations テーブル運用を再開したら旧ロジックを戻す
  await interaction.editReply({
    content: COMMAND_MESSAGES.CURRENTLY_DISABLED,
  });
}
