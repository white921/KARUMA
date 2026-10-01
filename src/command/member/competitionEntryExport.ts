import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { COMMAND_NAMES } from "../../constant/shared/command";
import { CompetitionEntryService } from "../../service/member/competitionEntryService";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.COMPETITION_ENTRY_EXPORT)
  .setDescription("自チームの双璧戦競技回答をスプレッドシート用CSVで出力します")
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  await CompetitionEntryService.exportForLeader(interaction);
}
