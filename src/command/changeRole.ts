import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  User,
} from "discord.js";

import { ChangeRoleService } from "../service/changeRoleService";

import { COMMAND_NAMES } from "../constant/command";
import { ACCOUNT_MESSAGES } from "../constant/account";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.CHANGE_ROLE)
  .setDescription("指定したユーザーにロールを追加または削除します。")
  .addUserOption((option) =>
    option.setName("user").setDescription("対象ユーザー").setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("action")
      .setDescription("追加 or 削除")
      .setRequired(true)
      .addChoices(
        { name: "追加", value: "add" },
        { name: "削除", value: "remove" }
      )
  )
  .addRoleOption((option) =>
    option.setName("role").setDescription("対象ロール").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser("user") as User;
  const member = await interaction.guild?.members.fetch(user.id);
  if (!member) {
    throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
  }
  const action = interaction.options.getString("action");
  const role = interaction.options.getRole("role");

  try {
    // 権限チェック(中で技術者かどうか確認)
    await ChangeRoleService.validateChangeRole(
      interaction.member as GuildMember
    );

    // ロール変更処理
    await ChangeRoleService.changeRole(
      member!,
      role!.id,
      action as "add" | "remove"
    );

    await interaction.editReply({
      content: `✅ <@${user.id}> さんのロールを正常に変更しました。`,
    });
  } catch (error) {
    throw error;
  }
}
