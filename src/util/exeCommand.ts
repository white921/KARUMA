import { ChatInputCommandInteraction } from "discord.js";

import { execute as test } from "../command/test";
import { execute as panel } from "../command/panel";
import { execute as returnMember } from "../command/returnMember";
import { execute as interview } from "../command/interview";
import { execute as evaluationSheet } from "../command/evaluationSheet";
import { execute as send } from "../command/send";
import { execute as roleBasedSend } from "../command/roleBasedSend";
import { execute as view } from "../command/view";
import { execute as linkAccount } from "../command/linkAccount";
import { execute as ranking } from "../command/ranking";
import { execute as openAccount } from "../command/openAccount";
import { execute as adminOpenAccount } from "../command/adminOpenAccount";
import { execute as changeName } from "../command/changeName";
import { execute as changeRole } from "../command/changeRole";
import { execute as checkName } from "../command/checkName";
// import { execute as inviteExtend } from "../command/inviteExtend";
// import { execute as showEvaluation } from "../command/showEvaluation";
import { execute as extraExtend } from "../command/extraExtend";
// import { execute as showEvaluationEnd } from "../command/showEvaluationEnd";

import { COMMAND_MESSAGES, COMMAND_NAMES } from "../constant/command";

export async function exeCommand(
  interaction: ChatInputCommandInteraction,
  command: string
) {
  try {
    switch (command) {
      case COMMAND_NAMES.TEST:
        await test(interaction);
        break;
      case COMMAND_NAMES.PANEL:
        await panel(interaction);
        break;
      case COMMAND_NAMES.RETURN_MEMBER:
        await returnMember(interaction);
        break;
      case COMMAND_NAMES.INTERVIEW_PASS:
        await interview(interaction);
        break;
      case COMMAND_NAMES.EVALUATION_SHEET:
        await evaluationSheet(interaction);
        break;
      case COMMAND_NAMES.SEND:
        await send(interaction);
        break;
      case COMMAND_NAMES.ROLE_BASED_SEND:
        await roleBasedSend(interaction);
        break;
      case COMMAND_NAMES.VIEW:
        await view(interaction);
        break;
      case COMMAND_NAMES.LINK_ACCOUNT:
        await linkAccount(interaction);
        break;
      case COMMAND_NAMES.RANKING:
        await ranking(interaction);
        break;
      case COMMAND_NAMES.OPEN_ACCOUNT:
        await openAccount(interaction);
        break;
      case COMMAND_NAMES.ADMIN_OPEN_ACCOUNT:
        await adminOpenAccount(interaction);
        break;
      case COMMAND_NAMES.CHANGE_NAME:
        await changeName(interaction);
        break;
      case COMMAND_NAMES.CHANGE_ROLE:
        await changeRole(interaction);
        break;
      case COMMAND_NAMES.CHECK_NAME:
        await checkName(interaction);
        break;
      // case COMMAND_NAMES.INVITE_EXTEND:
      //   await inviteExtend(interaction);
      //   break;
      // case COMMAND_NAMES.SHOW_EVALUATION:
      //   await showEvaluation(interaction);
      //   break;
      case COMMAND_NAMES.EXTRA_EXTEND:
        await extraExtend(interaction);
        break;
      // case COMMAND_NAMES.SHOW_EVALUATION_END:
      //   await showEvaluationEnd(interaction);
      //   break;
      default:
        throw new Error(COMMAND_MESSAGES.UNKNOWN_COMMAND);
        break;
    }
  } catch (error) {
    throw error;
  }
}
