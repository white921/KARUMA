import { ChatInputCommandInteraction, Client, GuildMember } from "discord.js";

import { ROLE_IDS, TEXT_CHANNEL_IDS, THREAD_IDS } from "../constant/id";
import { AdminPanelService } from "./adminPanelService";
import { CasinoPanelService } from "./casinoPanel";
import { DiaryPanelService } from "./diaryPanelService";
import { GamePanelService } from "./gamePanelService";
import { HotelVcPanelService } from "./hotelPanelService";
import { PanelService } from "./panelService";
import { RedeployPanelService } from "./redeployPanelService";
import { ShopPanelService } from "./shopPanelService";

export const PANEL_INSTALL_TARGETS = {
  BANK: "bank",
  ADMIN_BANK: "admin_bank",
  HOTEL: "hotel",
  GAME: "game",
  CASINO: "casino",
  SHOP: "shop",
  DIARY: "diary",
  REDEPLOY: "redeploy",
} as const;

type PanelInstallTarget =
  (typeof PANEL_INSTALL_TARGETS)[keyof typeof PANEL_INSTALL_TARGETS];

const PANEL_INSTALL_TARGET_LABELS: Record<PanelInstallTarget, string> = {
  [PANEL_INSTALL_TARGETS.BANK]: "銀行パネル",
  [PANEL_INSTALL_TARGETS.ADMIN_BANK]: "管理者銀行パネル",
  [PANEL_INSTALL_TARGETS.HOTEL]: "ホテルVCパネル",
  [PANEL_INSTALL_TARGETS.GAME]: "ゲームパネル",
  [PANEL_INSTALL_TARGETS.CASINO]: "カジノパネル",
  [PANEL_INSTALL_TARGETS.SHOP]: "ショップパネル",
  [PANEL_INSTALL_TARGETS.DIARY]: "日記パネル",
  [PANEL_INSTALL_TARGETS.REDEPLOY]: "再起動パネル",
};

const PANEL_INSTALL_CHANNEL_MAP: Record<string, PanelInstallTarget> = {
  [TEXT_CHANNEL_IDS.GINKOU_PANEL]: PANEL_INSTALL_TARGETS.BANK,
  [THREAD_IDS.ADMIN_PANEL_THREAD]: PANEL_INSTALL_TARGETS.ADMIN_BANK,
  [TEXT_CHANNEL_IDS.NORMAL_HOTEL_VC_PANEL]: PANEL_INSTALL_TARGETS.HOTEL,
  [TEXT_CHANNEL_IDS.SPECIAL_HOTEL_VC_PANEL]: PANEL_INSTALL_TARGETS.HOTEL,
  [TEXT_CHANNEL_IDS.GAME_PANEL]: PANEL_INSTALL_TARGETS.GAME,
  [TEXT_CHANNEL_IDS.CASINO_PANEL]: PANEL_INSTALL_TARGETS.CASINO,
  [TEXT_CHANNEL_IDS.SHOP_PANEL]: PANEL_INSTALL_TARGETS.SHOP,
  [THREAD_IDS.DIARY_PANEL_THREAD]: PANEL_INSTALL_TARGETS.DIARY,
  [TEXT_CHANNEL_IDS.REDEPLOY_PANEL]: PANEL_INSTALL_TARGETS.REDEPLOY,
};

export function resolvePanelInstallTarget(
  channelId: string,
): PanelInstallTarget | null {
  return PANEL_INSTALL_CHANNEL_MAP[channelId] ?? null;
}

async function assertPanelInstallerRole(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    throw new Error("このコマンドはサーバー内でのみ使用できます。");
  }

  const member = interaction.member instanceof GuildMember
    ? interaction.member
    : await interaction.guild!.members.fetch(interaction.user.id);

  if (!member.roles.cache.has(ROLE_IDS.GIJUTU_LEADER)) {
    throw new Error("このコマンドを実行する権限がありません。");
  }
}

async function installTargetPanel(
  client: Client,
  target: PanelInstallTarget,
): Promise<void> {
  switch (target) {
    case PANEL_INSTALL_TARGETS.BANK:
      await PanelService.createPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.ADMIN_BANK:
      await AdminPanelService.createAdminPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.HOTEL:
      await HotelVcPanelService.createHotelVcPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.GAME:
      await GamePanelService.createGamePanel(client);
      return;
    case PANEL_INSTALL_TARGETS.CASINO:
      await CasinoPanelService.createCasinoPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.SHOP:
      await ShopPanelService.createShopPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.DIARY:
      await DiaryPanelService.createDiaryPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.REDEPLOY:
      await RedeployPanelService.createRedeployPanel(client);
      return;
    default:
      throw new Error("未対応のパネルです。");
  }
}

export class PanelInstallService {
  static async installByCurrentChannel(
    interaction: ChatInputCommandInteraction,
  ): Promise<string> {
    await assertPanelInstallerRole(interaction);

    const channelId = interaction.channelId;
    const target = resolvePanelInstallTarget(channelId);
    if (!target) {
      throw new Error("このチャンネルには設置できるパネルが割り当てられていません。");
    }

    await installTargetPanel(interaction.client, target);

    return `✅ ${PANEL_INSTALL_TARGET_LABELS[target]}を設置しました。`;
  }
}
