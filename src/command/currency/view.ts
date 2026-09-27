import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { ViewService } from "../../service/currency/viewService";

import { COMMAND_NAMES } from "../../constant/shared/command";
import { assertManagementPermission } from "../../util/shared/managementPermission";
import { AccountService } from "../../service/account/accountService";
import { VIEW_MESSAGES } from "../../constant/currency/view";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.VIEW)
  .setDescription("指定ユーザーの残高を確認します（省略時は自分）")
  .setDMPermission(false)
  .addUserOption(option => option.setName("ユーザー").setDescription("残高を確認するユーザー"));

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    if (!interaction.guild) throw new Error("サーバー内でのみ使用できます。");
    const user = interaction.options.getUser("ユーザー") ?? interaction.user;
    if (user.id !== interaction.user.id) {
      await assertManagementPermission(interaction);
    }
    await ViewService.validateView(user.id);
    const [account] = await AccountService.getAccountByUserId(user.id);
    await interaction.editReply({
      content: VIEW_MESSAGES.BALANCE_OF_USER(user.id, account.wallet),
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    throw error;
  }
}
