import { GuildMember } from "discord.js";

import { ADMIN_BANK_PANEL_ROLE_IDS } from "../../constant/currency/admin";
import { hasOperatorRole } from "../shared/operatorPermission";



export async function hasAdminBankPanelPermission(
  member: GuildMember,
): Promise<boolean> {
  return hasOperatorRole(member, ADMIN_BANK_PANEL_ROLE_IDS);
}
