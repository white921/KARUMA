import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  User,
} from "discord.js";

import { ChangeNameService } from "../service/changeNameService";
import { AccountService } from "../service/accountService";
import { LinkAccountService } from "../service/linkAccountService";

import { COMMAND_NAMES } from "../constant/command";
import { ACCOUNT_MESSAGES } from "../constant/account";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.CHANGE_NAME)
  .setDescription("表示名を変更します")
  .addUserOption((option) =>
    option
      .setName("target_member")
      .setDescription("表示名を変更するユーザー")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName("new_name").setDescription("新しい表示名").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const targetUser = interaction.options.getUser("target_member") as User;
    const targetMember = await interaction.guild?.members.fetch(targetUser.id);
    if (!targetMember) {
      throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
    }

    const newName = interaction.options.getString("new_name") as string;

    const user = await interaction.guild!.members.fetch(interaction.user);
    await ChangeNameService.validateChangeName(targetMember, newName, user);
    await ChangeNameService.changeName(interaction, targetMember.id, newName);

    const subUserId = await AccountService.getSubUserIdByMainUserId(
      targetMember.id
    );
    if (subUserId) {
      const subMember = await interaction.guild?.members.fetch(subUserId);
      await LinkAccountService.changeSubAccountDisplayName(
        targetMember,
        subMember!
      );
    }

    await interaction.editReply({
      content: `✅ 表示名を<@${targetMember.id}> に変更しました。`,
    });
  } catch (error) {
    throw error;
  }
}
