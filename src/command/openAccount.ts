import {
  ChatInputCommandInteraction,
  GuildMember,
  SlashCommandBuilder,
} from "discord.js";

import { AccountService } from "../service/accountService";
import { OpenAccountService } from "../service/openAccountService";

import { COMMAND_NAMES } from "../constant/command";
import { INITIAL_WALLET } from "../constant/account";
import { CURRENCY_NAMES } from "../constant/currency";
import { formatNumber } from "../util/number";

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.OPEN_ACCOUNT)
  .setDescription("口座を開設します");

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await OpenAccountService.openAccountValidate(interaction);

    const member = interaction.member as GuildMember;

    await AccountService.createAccount(
      member.id,
      member.displayName,
      INITIAL_WALLET
    );

    await interaction.editReply({
      content: `✅ 口座を開設しました。\n初期残高は ${formatNumber(INITIAL_WALLET)} ${CURRENCY_NAMES} です。`,
    });
  } catch (error) {
    throw error;
  }
}
