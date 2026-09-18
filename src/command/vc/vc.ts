import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { COMMAND_NAMES } from "../../constant/shared/command";
import { VcService } from "../../service/vc/vcService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.ROOM_NAME_CHANGE)
  .setDescription("自分が作成したVCの部屋名を変更します")
  .setDMPermission(false)
  .addStringOption((option) =>
    option
      .setName("new_name")
      .setDescription("新しい部屋名")
      .setRequired(true)
      .setMaxLength(100),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const name = await VcService.changeOwnedManagedVcName(
    interaction,
    interaction.options.getString("new_name", true),
  );
  await interaction.editReply({ content: `✅ 部屋名を「${name}」に変更しました。` });
}
