import type { GuildMember } from "discord.js";
import type { Account } from "../account/account";

export type SkipReason = "bot" | "subAccount" | "accountNotFound";

export type TargetUser = {
  member: GuildMember;
  account: Account;
};
