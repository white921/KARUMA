import { ROLE_IDS } from "../constant/id";
import { EVALUATION_SHEET_MESSAGES } from "../constant/evaluationSheet";

type RoleBackedMember = {
  roles?: {
    cache?: {
      has: (roleId: string) => boolean;
    };
  };
};

export const EVALUATION_SHEET_ARCHIVE_ALLOWED_ROLE_IDS = [
  ROLE_IDS.GIJUTU_LEADER,
  ROLE_IDS.SABANUSI,
  ROLE_IDS.EVALUATION_LEADER,
  ROLE_IDS.KANRISYA,
] as const;

export function canManageEvaluationSheetArchive(member: unknown): boolean {
  const roleBackedMember = member as RoleBackedMember | null | undefined;
  return EVALUATION_SHEET_ARCHIVE_ALLOWED_ROLE_IDS.some((roleId) =>
    Boolean(roleBackedMember?.roles?.cache?.has(roleId)),
  );
}

export function assertCanManageEvaluationSheetArchive(member: unknown): void {
  if (!canManageEvaluationSheetArchive(member)) {
    throw new Error(EVALUATION_SHEET_MESSAGES.ARCHIVE_NO_PERMISSION);
  }
}

export function isDiscordUserId(value: string): boolean {
  return /^\d{17,20}$/.test(value);
}
