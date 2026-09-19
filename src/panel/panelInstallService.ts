import { PrivateHotelPanelService } from "./hotel/privateHotelPanelService";
import { ChatInputCommandInteraction, Client, GuildMember } from "discord.js";
import { getRoulettePanelChannelId, ROLE_IDS } from "../constant/shared/id";
import {
  PANEL_INSTALL_CHANNEL_MAP,
  PANEL_INSTALL_TARGET_LABELS,
  PANEL_INSTALL_TARGETS,
} from "../constant/panel/panelInstall";
import type { PanelInstallTarget } from "../type/panel/panelInstall";
import { CasinoPanelService } from "./casino/casinoPanel";
import { RoulettePanelService } from "./casino/roulettePanelService";
import { AdminPanelService } from "./currency/adminPanelService";
import { PanelService } from "./currency/panelService";
import { DiaryPanelService } from "./diary/diaryPanelService";
import { GamePanelService } from "./game/gamePanelService";
import { HotelVcPanelService } from "./hotel/hotelPanelService";
import { CreatorEmblemPanelService } from "./market/creatorEmblemPanelService";
import { ShopPanelService } from "./market/shopPanelService";
import { SuperchatPanelService } from "./market/superchatPanelService";
import { OmikujiPanelService } from "./omikuji/omikujiPanelService";
import { RedeployPanelService } from "./system/redeployPanelService";
import { HazamaPanelService } from "./vc/hazamaPanelService";
import { SolitaryCellPanelService } from "./vc/solitaryCellPanelService";

export function resolvePanelInstallTarget(
  channelId: string,
): PanelInstallTarget | null {
  if (channelId === getRoulettePanelChannelId(1) && getRoulettePanelChannelId(1)) return PANEL_INSTALL_TARGETS.ROULETTE_1ST;
  if (channelId === getRoulettePanelChannelId(2) && getRoulettePanelChannelId(2)) return PANEL_INSTALL_TARGETS.ROULETTE_2ND;
  if (channelId === getRoulettePanelChannelId(3) && getRoulettePanelChannelId(3)) return PANEL_INSTALL_TARGETS.ROULETTE_3RD;
  return PANEL_INSTALL_CHANNEL_MAP.get(channelId) ?? null;
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
    case PANEL_INSTALL_TARGETS.PRIVATE_HOTEL:
      await PrivateHotelPanelService.createPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.HOTEL:
      await HotelVcPanelService.createHotelVcPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.SOLITARY_CELL:
      await SolitaryCellPanelService.createPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.GAME:
      await GamePanelService.createGamePanel(client);
      return;
    case PANEL_INSTALL_TARGETS.GAME_CRIMINAL:
      await GamePanelService.createGameCriminalPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.HAZAMA:
      await HazamaPanelService.createPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.CASINO:
      await CasinoPanelService.createCasinoPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.SHOP:
      await ShopPanelService.createShopPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.COURT_SHOP:
      await ShopPanelService.createCourtShopPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.DARK_SHOP:
      await ShopPanelService.createDarkShopPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.CREATOR_EMBLEM:
      await CreatorEmblemPanelService.createPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.SUPERCHAT:
      await SuperchatPanelService.createPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.OMIKUJI:
      await OmikujiPanelService.createPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.DIARY:
      await DiaryPanelService.createDiaryPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.REDEPLOY:
      await RedeployPanelService.createRedeployPanel(client);
      return;
    case PANEL_INSTALL_TARGETS.ROULETTE_1ST:
      await RoulettePanelService.createPanel(client, 1);
      return;
    case PANEL_INSTALL_TARGETS.ROULETTE_2ND:
      await RoulettePanelService.createPanel(client, 2);
      return;
    case PANEL_INSTALL_TARGETS.ROULETTE_3RD:
      await RoulettePanelService.createPanel(client, 3);
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
