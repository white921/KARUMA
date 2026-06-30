import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { COMMAND_MESSAGES, COMMAND_NAMES } from "../constant/command";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.INVITE_EXTEND)
  .setDescription("招待数を評価期間に反映させます")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("連携させるユーザー")
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option.setName("male").setDescription("男性").setMinValue(1)
  )
  .addIntegerOption((option) =>
    option.setName("female").setDescription("女性").setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  // 現在Aetherでは評価DBを使っていないため停止中。
  // TODO: evaluations テーブル運用を再開したら旧ロジックを戻す
  await interaction.editReply({
    content: COMMAND_MESSAGES.CURRENTLY_DISABLED,
  });
}
