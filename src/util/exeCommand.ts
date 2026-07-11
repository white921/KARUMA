import { ChatInputCommandInteraction, GuildMember } from "discord.js";

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
import { execute as roulette } from "../command/roulette";
import { execute as result } from "../command/result";
// import { execute as showEvaluationEnd } from "../command/showEvaluationEnd";

import { COMMAND_MESSAGES, COMMAND_NAMES } from "../constant/command";
import { ROLE_IDS } from "../constant/id";

export const TEMPORARY_TECHNICAL_DIRECTOR_ONLY_MESSAGE =
  "現在スラッシュコマンドは一時的に技術統括のみ実行できます。";

type RoleBackedMember = {
  roles?: {
    cache?: {
      has: (roleId: string) => boolean;
    };
  };
};

export function canUseTemporaryTechnicalDirectorOnly(
  member: unknown,
): boolean {
  const roleBackedMember = member as RoleBackedMember | null | undefined;
  return Boolean(roleBackedMember?.roles?.cache?.has(ROLE_IDS.GIJUTU_LEADER));
}

export async function assertTemporaryTechnicalDirectorOnly(
  interaction: Pick<ChatInputCommandInteraction, "guild" | "member" | "user">,
) {
  if (canUseTemporaryTechnicalDirectorOnly(interaction.member)) {
    return;
  }

  if (interaction.guild && !(interaction.member instanceof GuildMember)) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (canUseTemporaryTechnicalDirectorOnly(member)) {
      return;
    }
  }

  throw new Error(TEMPORARY_TECHNICAL_DIRECTOR_ONLY_MESSAGE);
}

export async function exeCommand(
  interaction: ChatInputCommandInteraction,
  command: string
) {
  try {
    // ルーレット運営コマンドはイベント運営ロールにも個別に許可する。
    if (command !== COMMAND_NAMES.ROULETTE && command !== COMMAND_NAMES.ROULETTE_RESULT) {
      await assertTemporaryTechnicalDirectorOnly(interaction);
    }

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
      case COMMAND_NAMES.ROULETTE:
        await roulette(interaction);
        break;
      case COMMAND_NAMES.ROULETTE_RESULT:
        await result(interaction);
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
