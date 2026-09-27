import { COMMAND_NAMES } from "../../constant/shared/command";

import { LONG_RUNNING_EVALUATION_HANDLER_TIMEOUT_MS } from "../../constant/evaluation/evaluationSheet";
import { MANAGEMENT_HANDLER_TIMEOUT_MS } from "../../constant/shared/management";

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
