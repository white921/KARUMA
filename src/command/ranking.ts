// src/commands/ranking.ts
import {
  ChatInputCommandInteraction,
  Role,
  SlashCommandBuilder,
} from "discord.js";

import { requireChannel } from "../util/channelGuard";
import { isTechnician } from "../util/role";

import { RankingService } from "../service/ranking";

import { TEST_CHANNEL_ID } from "../constant/id";
import { COMMAND_MESSAGES, COMMAND_NAMES } from "../constant/command";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.RANKING)
  .setDescription("残高ランキングを表示")
  .addRoleOption((option) =>
    option
      .setName("role")
      .setDescription("指定したロール内でランキングを表示")
      .setRequired(false)
  )
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {

    const userId = interaction.user.id;
    if (!(await isTechnician(interaction.user))) {
      await RankingService.validateRanking(interaction.guild!, userId);
    }

    const role = interaction.options.getRole("role") as Role | null;

    // botと特定ロール所有者を除いた全ユーザー、または指定ロール内のランキングを取得
    const ranking = await RankingService.getRanking(interaction.guild!, role?.id);

    // ランキングメッセージを作成
    const rankingMessages = await RankingService.createRankingMessage(
      ranking,
      role?.name
    );

    // ランキングメッセージを送信
    await interaction.followUp({
      embeds: [rankingMessages],
      ephemeral: true,
    });
  } catch (error) {
    throw error;
  }
}
