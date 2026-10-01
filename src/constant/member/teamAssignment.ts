import { ROLE_IDS, THREAD_IDS } from "../shared/id";

export const TEAM_ASSIGNMENT_PANEL_TITLE = "第１回 LEVELIA双璧戦 チーム分けパネル";
export const TEAM_ASSIGNMENT_PANEL_CHANNEL_ID = THREAD_IDS.TEAM_ASSIGNMENT_PANEL;
export const TEAM_ASSIGNMENT_PREFIX = "teamAssignment";
export const TEAM_ASSIGNMENT_PASSPHRASE_INPUT_ID = "passphrase";
export const TEAM_ASSIGNMENT_CONFIRMATION_TTL_MS = 5 * 60 * 1000;

export const TEAM_ASSIGNMENTS = {
  red: {
    label: "紅組",
    roleId: ROLE_IDS.TEAM_RED,
    passphrase: "あか",
    captainUserId: "1363509186461176121", // 夏
    viceCaptainUserId: "1536218537696165949", // エロ感ワイド
  },
  blue: {
    label: "蒼組",
    roleId: ROLE_IDS.TEAM_BLUE,
    passphrase: "あお",
    captainUserId: "1508435688218169457", // 朱桜
    viceCaptainUserId: "1508895495873888452", // killer対象外
  },
} as const;

export type TeamAssignmentKey = keyof typeof TEAM_ASSIGNMENTS;

export function isTeamAssignmentKey(value: string): value is TeamAssignmentKey {
  return value in TEAM_ASSIGNMENTS;
}

export function createTeamAssignmentCustomId(
  action: "select" | "modal",
  team: TeamAssignmentKey,
): string {
  return `${TEAM_ASSIGNMENT_PREFIX}:${action}:${team}`;
}
