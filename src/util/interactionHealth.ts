import { COMMAND_NAMES } from "../constant/command";

export const LONG_RUNNING_EVALUATION_HANDLER_TIMEOUT_MS = 15 * 60 * 1000;

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
