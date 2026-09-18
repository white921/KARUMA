import type { GuildMember } from "discord.js";

export type ValidateVcMemberNamesResult = {
  successes: GuildMember[];
  failures: { member: GuildMember; reason: string }[];
  warnings: { member: GuildMember; reason: string }[];
};
