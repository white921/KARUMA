import { letterData, whisperData } from "./command/market/darkMessagePanel";
import { data as gachaCoinGrant } from "./command/market/gachaCoinGrant";
import { data as gachaCoinDeduct } from "./command/market/gachaCoinDeduct";
// src/registerCommands.ts
import { REST, Routes } from "discord.js";
import dotenv from "dotenv";

import { data as test } from "./command/system/test";
import { data as panel } from "./command/panel/panel";
import { data as returnMember } from "./command/account/returnMember";
import { data as interview } from "./command/evaluation/interview";
import { data as evaluationSheet } from "./command/evaluation/evaluationSheet";
import { data as evaluationSheetArchive } from "./command/evaluation/evaluationSheetArchive";
import { data as evaluationSheetRestore } from "./command/evaluation/evaluationSheetRestore";
import { data as send } from "./command/currency/send";
import { data as balanceAdjustment } from "./command/currency/balanceAdjustment";
import { data as roleBasedSend } from "./command/currency/roleBasedSend";
import { data as view } from "./command/currency/view";
import { data as linkAccount } from "./command/account/linkAccount";
import { data as ranking } from "./command/currency/ranking";
import { data as changeName } from "./command/account/changeName";
import { data as openAccount } from "./command/account/openAccount";
import { data as adminOpenAccount } from "./command/account/adminOpenAccount";
import { data as changeRole } from "./command/member/changeRole";
import { data as checkName } from "./command/evaluation/checkName";
import { data as extraExtend } from "./command/evaluation/extraExtend";
import { data as roulette } from "./command/casino/roulette";
import { data as rouletteClose } from "./command/casino/rouletteClose";
import { data as rouletteBonus } from "./command/casino/rouletteBonus";
import { data as result } from "./command/casino/result";
import { data as invitePointAdd } from "./command/market/invitePointAdd";
import { data as vc } from "./command/vc/vc";

dotenv.config();

function getRequiredEnv(name: "DISCORD_TOKEN" | "CLIENT_ID" | "GUILD_ID") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`❌ ${name} が設定されていません。`);
  }
  return value;
}

export async function registerCommands() {
  const commands = [
    letterData.toJSON(),
    whisperData.toJSON(),
    test.toJSON(),
    panel.toJSON(),
    returnMember.toJSON(),
    interview.toJSON(),
    evaluationSheet.toJSON(),
    evaluationSheetArchive.toJSON(),
    evaluationSheetRestore.toJSON(),
    send.toJSON(),
    balanceAdjustment.toJSON(),
    roleBasedSend.toJSON(),
    view.toJSON(),
    linkAccount.toJSON(),
    ranking.toJSON(),
    changeName.toJSON(),
    openAccount.toJSON(),
    adminOpenAccount.toJSON(),
    // changeRole.toJSON(),
    checkName.toJSON(),
    extraExtend.toJSON(),
    roulette.toJSON(),
    rouletteClose.toJSON(),
    rouletteBonus.toJSON(),
    result.toJSON(),
    invitePointAdd.toJSON(),
    gachaCoinGrant.toJSON(),
    gachaCoinDeduct.toJSON(),
    vc.toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(
    getRequiredEnv("DISCORD_TOKEN"),
  );

  try {
    await rest.put(
      Routes.applicationGuildCommands(
        getRequiredEnv("CLIENT_ID"),
        getRequiredEnv("GUILD_ID"),
      ),
      { body: commands },
    );
    console.log(`✅ コマンド登録が完了しました。(${commands.length}件)`);
  } catch (error) {
    console.error(error);
    throw new Error("❌ コマンド登録に失敗しました。");
  }
}

if (require.main === module) {
  registerCommands().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
