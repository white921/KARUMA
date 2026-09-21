import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from "discord.js";
import type { CAST_MENUS } from "../../constant/cast/castPayment";
export type CastMenu = keyof typeof CAST_MENUS;
export type CastInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;
export interface CastSession {
  id: string; userId: string; guildId: string; channelId: string;
  menu: CastMenu; candidates: { id: string; name: string }[]; castIds: string[];
  page: number; hours: number; amount: number; option: string;
  stage: "cast" | "time" | "option" | "confirm";
  revision: number; expiresAt: number; busy: boolean;
}
