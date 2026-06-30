import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { COMMAND_MESSAGES, COMMAND_NAMES } from "../constant/command";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.SHOW_EVALUATION_END)
  .setDescription("特定の日数以内に評価期間が終了するユーザーを表示します")
  .addIntegerOption((option) =>
    option
      .setName("days")
      .setDescription("終了までの日数")
      .setMinValue(0)
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // 現在Aetherでは評価DBを使っていないため停止中。
  // TODO: evaluations テーブル運用を再開したら旧ロジックを戻す
  await interaction.editReply({
    content: COMMAND_MESSAGES.CURRENTLY_DISABLED,
  });
}
