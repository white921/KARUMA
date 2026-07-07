// src/registerCommands.ts
import { REST, Routes } from "discord.js";
import dotenv from "dotenv";

import { data as test } from "./command/test";
import { data as panel } from "./command/panel";
import { data as returnMember } from "./command/returnMember";
import { data as interview } from "./command/interview";
import { data as evaluationSheet } from "./command/evaluationSheet";
import { data as send } from "./command/send";
import { data as roleBasedSend } from "./command/roleBasedSend";
import { data as view } from "./command/view";
import { data as linkAccount } from "./command/linkAccount";
import { data as ranking } from "./command/ranking";
import { data as changeName } from "./command/changeName";
import { data as openAccount } from "./command/openAccount";
import { data as adminOpenAccount } from "./command/adminOpenAccount";
import { data as changeRole } from "./command/changeRole";
import { data as checkName } from "./command/checkName";
// import { data as inviteExtend } from "./command/inviteExtend";
// import { data as showEvaluation } from "./command/showEvaluation";
import { data as extraExtend } from "./command/extraExtend";
// import { data as showEvaluationEnd } from "./command/showEvaluationEnd";

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
    test.toJSON(),
    panel.toJSON(),
    returnMember.toJSON(),
    interview.toJSON(),
    evaluationSheet.toJSON(),
    send.toJSON(),
    roleBasedSend.toJSON(),
    view.toJSON(),
    linkAccount.toJSON(),
    ranking.toJSON(),
    changeName.toJSON(),
    openAccount.toJSON(),
    adminOpenAccount.toJSON(),
    // changeRole.toJSON(),
    checkName.toJSON(),
    // inviteExtend.toJSON(),
    // showEvaluation.toJSON(),
    extraExtend.toJSON(),
    // showEvaluationEnd.toJSON(),
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
