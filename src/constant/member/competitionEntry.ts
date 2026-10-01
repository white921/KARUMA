import { THREAD_IDS } from "../shared/id";

export const COMPETITION_ENTRY_PREFIX = "competitionEntry";
export const COMPETITION_ENTRY_PANEL_TITLE =
  "第１回 LEVELIA双璧戦 競技エントリーシート";
export const COMPETITION_ENTRY_PANEL_CHANNEL_ID =
  THREAD_IDS.COMPETITION_ENTRY_PANEL;

export const COMPETITION_ENTRY_ACTIONS = {
  OPEN: `${COMPETITION_ENTRY_PREFIX}:open`,
  REVIEW: `${COMPETITION_ENTRY_PREFIX}:review`,
  EDIT: "edit",
  MODAL: "modal",
} as const;

export const COMPETITION_ENTRY_INPUT_IDS = {
  AVAILABILITY: "availability",
  RANK: "rank_name",
  GAME_NAME: "game_name",
  GAME_ID: "game_id",
  NOTES: "notes",
} as const;

export const COMPETITION_DISCIPLINES = {
  singing: {
    label: "歌",
    capacity: "各組 ♂2人・♀2人",
    rankLabel: null,
    gameNameLabel: "出場区分（♂ / ♀）",
    gameNamePlaceholder: "例：♂",
    gameIdLabel: null,
    notesLabel: "備考（任意）",
  },
  unite: {
    label: "Pokémon UNITE",
    capacity: "各組15人",
    rankLabel: "現在のランク",
    gameNameLabel: "ゲーム内ネーム",
    gameNamePlaceholder: "ゲーム内で表示される名前",
    gameIdLabel: "トレーナーID",
    notesLabel: "備考（任意）",
  },
  free: {
    label: "フリー枠",
    capacity: "人数未定",
    rankLabel: null,
    gameNameLabel: "希望する競技・企画",
    gameNamePlaceholder: "例：スマブラ、クイズ企画",
    gameIdLabel: "ゲームID等（任意）",
    notesLabel: "補足（任意）",
  },
  gf: {
    label: "GF",
    capacity: "各組16人",
    rankLabel: "ランク／レベル（ある場合）",
    gameNameLabel: "ゲーム内ネーム",
    gameNamePlaceholder: "ゲーム内で表示される名前",
    gameIdLabel: "ゲームID",
    notesLabel: "備考（任意）",
  },
  mahjong: {
    label: "麻雀（雀魂）",
    capacity: "各組4人",
    rankLabel: "雀魂の段位",
    rankPlaceholder: "例：雀傑2、雀豪1",
    gameNameLabel: "雀魂のゲーム内ネーム",
    gameNamePlaceholder: "雀魂で表示される名前",
    gameIdLabel: "雀魂のプレイヤーID",
    notesLabel: "備考（任意）",
  },
  fall_guys: {
    label: "Fall Guys",
    capacity: "人数未定",
    rankLabel: null,
    gameNameLabel: "ゲーム内ネーム",
    gameNamePlaceholder: "ゲーム内で表示される名前",
    gameIdLabel: "Epic Games ID",
    notesLabel: "備考（任意）",
  },
  valorant: {
    label: "VALORANT",
    capacity: "各組15人",
    rankLabel: "現在のランク",
    gameNameLabel: "ゲーム内ネーム",
    gameNamePlaceholder: "ゲーム内で表示される名前",
    gameIdLabel: "Riot ID（#タグまで）",
    notesLabel: "備考（任意）",
  },
  lol: {
    label: "League of Legends",
    capacity: "人数未定",
    rankLabel: "現在のランク",
    gameNameLabel: "ゲーム内ネーム",
    gameNamePlaceholder: "ゲーム内で表示される名前",
    gameIdLabel: "Riot ID（#タグまで）",
    notesLabel: "備考（任意）",
  },
  minecraft: {
    label: "Minecraft",
    capacity: "人数未定",
    rankLabel: null,
    gameNameLabel: "Minecraft内の名前",
    gameNamePlaceholder: "ゲーム内で表示される名前",
    gameIdLabel: "Microsoft / ゲーマータグ等",
    notesLabel: "統合版・Java版など（任意）",
  },
} as const;

export type CompetitionDisciplineKey = keyof typeof COMPETITION_DISCIPLINES;

export function isCompetitionDisciplineKey(
  value: string,
): value is CompetitionDisciplineKey {
  return value in COMPETITION_DISCIPLINES;
}

export function competitionEntryCustomId(
  action: "edit" | "modal",
  discipline: CompetitionDisciplineKey,
): string {
  return `${COMPETITION_ENTRY_PREFIX}:${action}:${discipline}`;
}
