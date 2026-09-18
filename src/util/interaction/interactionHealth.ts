import { COMMAND_NAMES } from "../../constant/shared/command";

import { LONG_RUNNING_EVALUATION_HANDLER_TIMEOUT_MS } from "../../constant/evaluation/evaluationSheet";

export function getEvaluationCommandHandlerTimeoutMs(
  commandName: string,
  hasTargetUser: boolean,
): number | undefined {
  if (
    commandName === COMMAND_NAMES.EVALUATION_SHEET ||
    commandName === COMMAND_NAMES.EVALUATION_SHEET_ARCHIVE ||
    commandName === COMMAND_NAMES.EVALUATION_SHEET_RESTORE ||
    (commandName === COMMAND_NAMES.EXTRA_EXTEND && !hasTargetUser)
  ) {
    return LONG_RUNNING_EVALUATION_HANDLER_TIMEOUT_MS;
  }

  return undefined;
}
