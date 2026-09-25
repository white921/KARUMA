import type { ItemKey } from "../inventory/item";
import type { RowDataPacket } from "mysql2";

export type MarketGachaPrizeKey =
  | "superchat"
  | "song_cover"
  | "idol_collab"
  | "superchat_nomination"
  | "game_free_1"
  | "game_free_3"
  | "secret_free_1"
  | "secret_free_3"
  | "freedom_free_1"
  | "discount_5"
  | "discount_10"
  | "detention_pass_3_days"
  | "custom_role_week"
  | "one_more_chance"
  | "miss"
  | "voice_message_nomination"
  | "letter"
  | "private_call"
  | "soundboard_week"
  | "gacha_coin_2"
  | "gacha_coin_4"
  | "gacha_coin_6"
  | "normal_hotel_free_1"
  | "hazama_free_3"
  | "solitary_cell_free_1";

export type MarketGachaAudioCategory = "superchat" | "song_cover";

export type MarketGachaPrize = {
  key: MarketGachaPrizeKey;
  label: string;
  probability: number;
  /** R2上の当選ファイルをDBから選んで渡す景品かどうか */
  audioCategory?: MarketGachaAudioCategory;
  itemKey?: ItemKey;
  quantity?: number;
  /** 毎回の基本1枚を含む合計枚数 */
  coins?: number;
};

export type WalletRow = RowDataPacket & { wallet: number };

export type AudioAssetRow = RowDataPacket & {
  id: number;
  performer_name: string;
  performer_user_id: string | null;
  file_name: string;
  public_url: string;
  created_at_epoch: number | string;
  selection_epoch: number | string;
};

export type MarketGachaAudioAsset = {
  id: number;
  performerName: string;
  performerUserId?: string;
  fileName: string;
  publicUrl: string;
};

export type MarketGachaPaymentSource = "currency" | "invite_point";
