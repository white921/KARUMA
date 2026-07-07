import { GuildMember } from "discord.js";

import { ROLE_IDS } from "../constant/id";
import { hasRole } from "./role";

const ADMIN_BANK_PANEL_ROLE_IDS = [
  ROLE_IDS.GINKOU_LEADER,
  ROLE_IDS.KANRISYA,
  ROLE_IDS.SABANUSI,
  ROLE_IDS.GIJUTU_LEADER,
];

export async function hasAdminBankPanelPermission(
  member: GuildMember,
): Promise<boolean> {
  for (const roleId of ADMIN_BANK_PANEL_ROLE_IDS) {
    if (await hasRole(member, roleId)) {
      return true;
    }
  }

  return false;
}
