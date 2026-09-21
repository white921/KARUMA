import { GachaCoinLogService } from "../../service/market/gachaCoinLogService";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { COMMAND_NAMES } from "../../constant/shared/command";
import { GACHA_COIN_MAX } from "../../constant/market/gachaCoin";
import { GachaCoinService } from "../../service/market/gachaCoinService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.GACHA_COIN_DEDUCT).setDescription("ユーザーのガチャコインを減算します").setDMPermission(false)
  .addUserOption(o => o.setName("ユーザー").setDescription("対象ユーザー").setRequired(true))
  .addIntegerOption(o => o.setName("枚数").setDescription("減算するコイン枚数").setMinValue(1).setMaxValue(GACHA_COIN_MAX).setRequired(true))
  .addStringOption(o => o.setName("理由").setDescription("付与理由や交換した景品など").setMaxLength(256).setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await GachaCoinService.assertOperator(interaction);
  const user = interaction.options.getUser("ユーザー", true);
  const amount = interaction.options.getInteger("枚数", true);
  const reason = interaction.options.getString("理由", true);
  const balance = await GachaCoinService.adjust(interaction.id, user.id, amount * -1, interaction.user.id, reason);
  await GachaCoinLogService.send(interaction.client, interaction.guildId!, {
    targetUserId: user.id, operatorUserId: interaction.user.id, amount: amount * -1,
    afterCoins: balance, reason, interactionId: interaction.id,
  });
  await interaction.editReply({ content: `✅ <@${user.id}> のガチャコインを ${amount}枚減算しました。残高: **${balance}枚**`, allowedMentions: { parse: [] } });
}
