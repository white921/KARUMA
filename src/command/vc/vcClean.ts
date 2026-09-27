import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { COMMAND_NAMES } from "../../constant/shared/command";
import { VcCleanService } from "../../service/vc/vcCleanService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.VC_CLEAN)
  .setDescription("参加中のVCのインチャを掃除します（パネル・期限案内・ピン留めは保持）")
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const result = await VcCleanService.clean(interaction);
  await interaction.editReply({ content:
    `${result.complete ? "✅ 掃除が完了しました。" : "掃除を一時中断しました。残りはもう一度コマンドを実行すると削除できます。"}\n` +
    `削除：${result.deleted}件／保持：${result.preserved}件\n操作パネル・期限案内・ピン留めは残しています。`,
  });
}
