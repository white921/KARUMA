import { execute as darkMessagePanel } from "../../command/market/darkMessagePanel";
import { DARK_MESSAGE_PRODUCTS } from "../../constant/market/darkMessage";
import { execute as gachaCoinGrant } from "../../command/market/gachaCoinGrant";
import { execute as gachaCoinDeduct } from "../../command/market/gachaCoinDeduct";
import { ChatInputCommandInteraction } from "discord.js";

import { execute as test } from "../../command/system/test";
import { execute as panel } from "../../command/panel/panel";
import { execute as returnMember } from "../../command/account/returnMember";
import { execute as interview } from "../../command/evaluation/interview";
import { execute as evaluationSheet } from "../../command/evaluation/evaluationSheet";
import { execute as evaluationSheetArchive } from "../../command/evaluation/evaluationSheetArchive";
import { execute as evaluationSheetRestore } from "../../command/evaluation/evaluationSheetRestore";
import { execute as send } from "../../command/currency/send";
import { execute as balanceAdjustment } from "../../command/currency/balanceAdjustment";
import { execute as roleBasedSend } from "../../command/currency/roleBasedSend";
import { execute as view } from "../../command/currency/view";
import { execute as linkAccount } from "../../command/account/linkAccount";
import { execute as ranking } from "../../command/currency/ranking";
import { execute as openAccount } from "../../command/account/openAccount";
import { execute as adminOpenAccount } from "../../command/account/adminOpenAccount";
import { execute as changeName } from "../../command/account/changeName";
import { execute as changeRole } from "../../command/member/changeRole";
import { execute as checkName } from "../../command/evaluation/checkName";
import { execute as extraExtend } from "../../command/evaluation/extraExtend";
import { execute as roulette } from "../../command/casino/roulette";
import { execute as rouletteClose } from "../../command/casino/rouletteClose";
import { execute as rouletteBonus } from "../../command/casino/rouletteBonus";
import { execute as result } from "../../command/casino/result";
import { execute as invitePointAdd } from "../../command/market/invitePointAdd";
import { execute as vc } from "../../command/vc/vc";

import { COMMAND_MESSAGES, COMMAND_NAMES } from "../../constant/shared/command";

export async function exeCommand(
  interaction: ChatInputCommandInteraction,
  command: string
) {
  try {
    switch (command) {
      case DARK_MESSAGE_PRODUCTS.letter.command:
      case DARK_MESSAGE_PRODUCTS.whisper.command:
        await darkMessagePanel(interaction);
        break;
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
      case COMMAND_NAMES.EVALUATION_SHEET_ARCHIVE:
        await evaluationSheetArchive(interaction);
        break;
      case COMMAND_NAMES.EVALUATION_SHEET_RESTORE:
        await evaluationSheetRestore(interaction);
        break;
      case COMMAND_NAMES.SEND:
        await send(interaction);
        break;
      case COMMAND_NAMES.BALANCE_ADJUSTMENT:
        await balanceAdjustment(interaction);
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
      case COMMAND_NAMES.EXTRA_EXTEND:
        await extraExtend(interaction);
        break;
      case COMMAND_NAMES.ROULETTE_OPEN:
        await roulette(interaction);
        break;
      case COMMAND_NAMES.ROULETTE_CLOSE:
        await rouletteClose(interaction);
        break;
      case COMMAND_NAMES.ROULETTE_RESULT:
        await result(interaction);
        break;
      case COMMAND_NAMES.ROULETTE_BONUS:
        await rouletteBonus(interaction);
        break;
      case COMMAND_NAMES.GACHA_COIN_GRANT:
        await gachaCoinGrant(interaction);
        break;
      case COMMAND_NAMES.GACHA_COIN_DEDUCT:
        await gachaCoinDeduct(interaction);
        break;
      case COMMAND_NAMES.INVITE_POINT_ADD:
        await invitePointAdd(interaction);
        break;
      case COMMAND_NAMES.ROOM_NAME_CHANGE:
        await vc(interaction);
        break;
      default:
        throw new Error(COMMAND_MESSAGES.UNKNOWN_COMMAND);
        break;
    }
  } catch (error) {
    throw error;
  }
}
