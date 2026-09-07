import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { VcService } from "../service/vcService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.VC)
  .setDescription("自分が作成したゲーム・ホテルVCを操作します")
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("name")
      .setDescription("参加中のVC名を変更します")
      .addStringOption((option) =>
        option
          .setName("new_name")
          .setDescription("新しいVC名")
          .setRequired(true)
          .setMaxLength(100),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("limit")
      .setDescription("参加中のVCの人数上限を変更します")
      .addIntegerOption((option) =>
        option
          .setName("members")
          .setDescription("人数上限（1〜99人）")
          .setMinValue(1)
          .setMaxValue(99)
          .setRequired(true),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "name") {
    const name = await VcService.changeOwnedGameOrHotelVcName(
      interaction,
      interaction.options.getString("new_name", true),
    );
    await interaction.editReply({ content: `✅ VC名を「${name}」に変更しました。` });
    return;
  }

  const limit = await VcService.changeOwnedGameOrHotelVcLimit(
    interaction,
    interaction.options.getInteger("members", true),
  );
  await interaction.editReply({ content: `✅ VCの人数上限を${limit}人に変更しました。` });
}
