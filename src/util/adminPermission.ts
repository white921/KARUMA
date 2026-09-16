import { GuildMember } from "discord.js";

import { ROLE_IDS } from "../constant/id";
import { hasOperatorRole } from "./operatorPermission";

const ADMIN_BANK_PANEL_ROLE_IDS = [
  ROLE_IDS.GINKOU_LEADER,
  ROLE_IDS.GINKOU_STAFF,
  ROLE_IDS.KANRISYA,
  ROLE_IDS.SABANUSI,
  ROLE_IDS.GIJUTU_LEADER,
];

export async function hasAdminBankPanelPermission(
  member: GuildMember,
): Promise<boolean> {
  return hasOperatorRole(member, ADMIN_BANK_PANEL_ROLE_IDS);
}
