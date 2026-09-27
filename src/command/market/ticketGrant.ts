import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { COMMAND_NAMES } from "../../constant/shared/command";
import { ROLE_IDS } from "../../constant/shared/id";
import { ITEM_DEFINITIONS } from "../../constant/inventory/item";
import { TicketGrantService } from "../../service/inventory/ticketGrantService";
import { MAX_TICKET_QUANTITY } from "../../constant/inventory/ticketGrant";
import { assertManagementPermission } from "../../util/shared/managementPermission";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.TICKET_GRANT).setDescription("指定ユーザーにチケットを付与します").setDMPermission(false)
  .addUserOption(option => option.setName("ユーザー").setDescription("付与先のユーザー").setRequired(true))
  .addStringOption(option => option.setName("種類").setDescription("付与するチケット").setRequired(true)
    .addChoices(...ITEM_DEFINITIONS.map(item => ({ name: item.name, value: item.key }))))
  .addIntegerOption(option => option.setName("枚数").setDescription("付与する枚数").setRequired(true).setMinValue(1).setMaxValue(MAX_TICKET_QUANTITY))
  .addStringOption(option => option.setName("理由").setDescription("付与理由").setRequired(true).setMaxLength(256));

export async function execute(interaction: ChatInputCommandInteraction) {
  await assertManagementPermission(interaction);
  const user = interaction.options.getUser("ユーザー", true);
  const member = await interaction.guild!.members.fetch({ user: user.id, force: true });
  if (member.user.bot) throw new Error("Botにはチケットを付与できません。");
  if (member.roles.cache.has(ROLE_IDS.SUB_ACCOUNT)) throw new Error("サブ垢には付与できません。メイン垢を指定してください。");
  const item = ITEM_DEFINITIONS.find(item => item.key === interaction.options.getString("種類", true));
  if (!item) throw new Error("チケットの種類が不正です。");
  const quantity = interaction.options.getInteger("枚数", true);
  const after = await TicketGrantService.grant(interaction.id, user.id, item.key, quantity, interaction.user.id, interaction.options.getString("理由", true));
  await interaction.editReply({
    content: `✅ <@${user.id}> に **${item.name}** を **${quantity}枚**付与しました。\n付与後の所持数：**${after}枚**`,
    allowedMentions: { parse: [] },
  });
}
