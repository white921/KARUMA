import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { COMMAND_NAMES } from "../constant/command";
import { ROLE_IDS } from "../constant/id";
import { AdminMintService } from "../service/adminMintService";
import { AdminBurnService } from "../service/adminBurnService";
import { hasOperatorRole } from "../util/operatorPermission";

const ALLOWED_ROLE_IDS = [
  ROLE_IDS.SABANUSI,
  ROLE_IDS.KANRISYA,
  ROLE_IDS.GINKOU_STAFF,
];

export const data = new SlashCommandBuilder()
  .setName(COMMAND_NAMES.BALANCE_ADJUSTMENT)
  .setDescription("皇帝・英傑・財務員・システム支配人が指定ユーザーのLIAを付与・剥奪します")
  .setDMPermission(false)
  .addUserOption((option) =>
    option
      .setName("ユーザー")
      .setDescription("残高を増減するユーザー")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("増減額")
      .setDescription("プラスで付与、マイナスで剥奪（例: 1000 / -1000、0は不可）")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("備考")
      .setDescription("付与・剥奪ログに残す理由や備考")
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    throw new Error("このコマンドはサーバー内でのみ使用できます。");
  }
  const operator = await interaction.guild.members.fetch({
    user: interaction.user.id,
    force: true,
  });
  if (!hasOperatorRole(operator, ALLOWED_ROLE_IDS)) {
    throw new Error("残高増減は皇帝・英傑・財務員・システム支配人のみ実行できます。");
  }

  const target = interaction.options.getUser("ユーザー", true);
  const amount = interaction.options.getInteger("増減額", true);
  const comment = interaction.options.getString("備考") ?? "";
  if (!Number.isSafeInteger(amount) || amount === 0) {
    throw new Error("増減額は0以外の整数で入力してください。");
  }

  if (amount > 0) {
    await AdminMintService.mint(interaction, target.id, amount, comment);
  } else {
    await AdminBurnService.burn(interaction, target.id, -amount, comment);
  }
}
