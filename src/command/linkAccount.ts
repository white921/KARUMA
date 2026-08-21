import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  User,
} from "discord.js";
import {
  addRole,
  copyRoleFromMainToSub,
  removeRolesExcept,
} from "../util/role";
import {
  assertCanManageLinkAccount,
  LinkAccountService,
} from "../service/linkAccountService";

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
    const operator = await interaction.guild?.members.fetch(interaction.user.id);
    assertCanManageLinkAccount(operator);

    const mainAccount = interaction.options.getUser("user") as User;
    const subAccount = interaction.options.getUser("sub_user") as User;

    const mainMember = await interaction.guild?.members.fetch(mainAccount.id);
    const subMember = await interaction.guild?.members.fetch(subAccount.id);

    await LinkAccountService.validateMainAccount(mainMember!);

    // サブ垢の既存ロールを整理し、本垢の同期対象ロールをコピー
    await removeRolesExcept(subMember!);
    await copyRoleFromMainToSub(mainMember!, subMember!);

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
