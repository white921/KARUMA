import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { DARK_MESSAGE_PRODUCTS, type DarkMessageKind } from "../../constant/market/darkMessage";
import { DarkMessageService } from "../../service/market/darkMessageService";

function command(kind: DarkMessageKind) {
  return new SlashCommandBuilder()
    .setName(DARK_MESSAGE_PRODUCTS[kind].command)
    .setDescription(`${DARK_MESSAGE_PRODUCTS[kind].title}の入金確認後、購入者専用パネルを発行します`)
    .setDMPermission(false)
    .addUserOption(option => option.setName("購入者").setDescription("入金を確認した購入者（本人だけが操作できます）").setRequired(true));
}

export const letterData = command("letter");
export const whisperData = command("whisper");
export async function execute(interaction: ChatInputCommandInteraction) {
  const kind = interaction.commandName === DARK_MESSAGE_PRODUCTS.letter.command ? "letter" : "whisper";
  await DarkMessageService.issue(interaction, kind);
}
