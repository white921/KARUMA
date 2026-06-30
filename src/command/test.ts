import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";

import { requireChannel } from "../util/channelGuard";

import { AccountService } from "../service/accountService";

import { COMMAND_MESSAGES } from "../constant/command";
import { TEST_CHANNEL_ID } from "../constant/id";

export const data = new SlashCommandBuilder()
  .setName("test")
  .setDescription("DB接続テスト");

export async function execute(interaction: ChatInputCommandInteraction) {
  const channelId = TEST_CHANNEL_ID.TC_001;
  try {
    const isRequireForum = await requireChannel(interaction, [channelId]);
    if (!isRequireForum) {
      throw new Error(COMMAND_MESSAGES.CHANNEL_RESTRICTED);
    }
    const userId = interaction.user.id;
    const accounts = await AccountService.getAccountByUserId(userId);
    await interaction.followUp({
      content: `<@${accounts[0]?.user_id}>`,
      ephemeral: false,
    });
  } catch (error) {
    throw error;
  }
}
