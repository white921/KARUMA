import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  User,
} from "discord.js";
import { addRole, isTechnician } from "../util/role";
import { LinkAccountService } from "../service/linkAccountService";

import { ROLE_IDS } from "../constant/id";
import { COMMAND_NAMES } from "../constant/command";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.LINK_ACCOUNT)
  .setDescription("連携処理を実行します")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("連携させるユーザー")
      .setRequired(true)
  )
  .addUserOption((option) =>
    option
      .setName("sub_user")
      .setDescription("連携させるサブユーザー")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const mainAccount = interaction.options.getUser("user") as User;
    const subAccount = interaction.options.getUser("sub_user") as User;

    const mainMember = await interaction.guild?.members.fetch(mainAccount.id);
    const subMember = await interaction.guild?.members.fetch(subAccount.id);

    // 実行者が技術者でなければバリデーションを行う
    if (!(await isTechnician(interaction.user))) {
      await LinkAccountService.validateMainAccount(mainMember!);
    }

    // サブ垢ロール付与
    await addRole(subMember!, ROLE_IDS.SUB_ACCOUNT);

    // 表示名の変更
    await LinkAccountService.changeSubAccountDisplayName(
      mainMember!,
      subMember!
    );

    // sub_accountsテーブルに登録
    await LinkAccountService.registerSubAccount(
      mainMember!.id,
      subMember!.id,
      subMember!.displayName
    );

    await interaction.editReply({
      content: `<@${mainMember!.id}> と <@${subMember!.id}> の連携が完了しました。`,
    });
  } catch (error) {
    throw error;
  }
}
