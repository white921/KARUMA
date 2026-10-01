import { COMMAND_NAMES, PANEL_COMMAND_NAMES } from "../../constant/shared/command";

import { LONG_RUNNING_EVALUATION_HANDLER_TIMEOUT_MS } from "../../constant/evaluation/evaluationSheet";
import { MANAGEMENT_HANDLER_TIMEOUT_MS } from "../../constant/shared/management";
import { VC_CHANNEL_EDIT_HANDLER_TIMEOUT_MS } from "../../constant/vc/vc";

export function getEvaluationCommandHandlerTimeoutMs(
  commandName: string,
  _hasTargetUser: boolean,
): number | undefined {
  if (commandName === COMMAND_NAMES.VC_CLEAN ||
      commandName === COMMAND_NAMES.ADMIN_OPEN_ACCOUNT ||
      commandName === COMMAND_NAMES.BALANCE_STATISTICS) {
    return MANAGEMENT_HANDLER_TIMEOUT_MS;
  }
  if (
    commandName === COMMAND_NAMES.EVALUATION_SHEET ||
    commandName === COMMAND_NAMES.EVALUATION_SHEET_ARCHIVE ||
    commandName === COMMAND_NAMES.EVALUATION_SHEET_RESTORE ||
    commandName === COMMAND_NAMES.EXTRA_EXTEND
  ) {
    return LONG_RUNNING_EVALUATION_HANDLER_TIMEOUT_MS;
  }

  return undefined;
}

/** Discord側で長いレート制限待ちになり得るVC名変更だけ監視猶予を延ばす。 */
export function getVcChannelEditHandlerTimeoutMs(
  customId: string,
): number | undefined {
  if (
    customId === PANEL_COMMAND_NAMES.CHANGE_VC_NAME ||
    customId === PANEL_COMMAND_NAMES.TOGGLE_VC_LOCK_MARK
  ) {
    return VC_CHANNEL_EDIT_HANDLER_TIMEOUT_MS;
  }

  return undefined;
}
