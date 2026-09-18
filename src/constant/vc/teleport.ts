import type { TeleportVcConfig } from "../../type/vc/teleportVc";
import { CATEGORY_IDS, VC_IDS } from "../shared/id";

export const TELEPORT_MESSAGE = {
  NOT_CATEGORY_FOUND: "動的VCカテゴリーが見つかりません",
  NOT_SERVER_FOUND: "サーバーが見つかりません",
  DELETE_TELEPORT_FAILED: "動的VCの削除に失敗しました",
  NOT_TELEPORT_VC_FOUND: "転送用VCが見つかりません",
};

export const TELEPORT_VC_CONFIGS: readonly TeleportVcConfig[] = [
  {
    triggerVcId: VC_IDS.GAME_TELEPORT,
    categoryId: CATEGORY_IDS.GAME,
  },
  {
    triggerVcId: VC_IDS.CASINO_TELEPORT,
    categoryId: CATEGORY_IDS.CASINO,
  },
  {
    triggerVcId: VC_IDS.HAZAMA_TELEPORT,
    categoryId: CATEGORY_IDS.HAZAMA,
  },
].filter((config) => Boolean(config.triggerVcId));
