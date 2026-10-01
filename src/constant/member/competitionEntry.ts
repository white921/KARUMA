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
    rankLabel: null,
    gameNameLabel: null,
    gameNamePlaceholder: null,
    gameIdLabel: null,
    notesLabel: "備考（任意）",
  },
  unite: {
    label: "Pokémon UNITE",
    rankLabel: "現在のランク",
    gameNameLabel: "トレーナー名",
    gameNamePlaceholder: "UNITEで公開されるトレーナー名",
    gameIdLabel: "トレーナーID",
    notesLabel: "備考（任意）",
  },
  free: {
    label: "フリー枠",
    rankLabel: null,
    gameNameLabel: "希望する競技・企画",
    gameNamePlaceholder: "例：スマブラ、クイズ企画",
    gameIdLabel: "その競技のネーム・ID等（任意）",
    notesLabel: "補足（任意）",
  },
  gf: {
    label: "GF",
    rankLabel: "決闘レーティング（分かる場合）",
    rankPlaceholder: "例：1500",
    gameNameLabel: "預言者の名前",
    gameNamePlaceholder: "GFで使用する預言者の名前",
    gameIdLabel: null,
    notesLabel: "備考（任意）",
  },
  mahjong: {
    label: "麻雀（雀魂）",
    rankLabel: "雀魂の段位",
    rankPlaceholder: "例：雀傑2、雀豪1",
    gameNameLabel: "雀魂のゲーム内ネーム",
    gameNamePlaceholder: "雀魂で表示される名前",
    gameIdLabel: "雀魂のプレイヤーID",
    notesLabel: "備考（任意）",
  },
  fall_guys: {
    label: "Fall Guys",
    rankLabel: "Ranked Knockoutの現在ランク",
    rankPlaceholder: "例：Gold、Ace、Superstar",
    gameNameLabel: "ゲーム内の表示名",
    gameNamePlaceholder: "Epic表示名／PSN ID／Xboxゲーマータグ",
    gameIdLabel: null,
    notesLabel: "使用機種（任意）",
  },
  valorant: {
    label: "VALORANT",
    rankLabel: "現在のランク",
    gameNameLabel: "Riot ID（ゲーム名#タグライン）",
    gameNamePlaceholder: "例：PlayerName#JP1",
    gameIdLabel: null,
    notesLabel: "備考（任意）",
  },
  lol: {
    label: "League of Legends",
    rankLabel: "現在のランク（ソロ／デュオ）",
    gameNameLabel: "Riot ID（ゲーム名#タグライン）",
    gameNamePlaceholder: "例：PlayerName#JP1",
    gameIdLabel: null,
    notesLabel: "メインロール等（任意）",
  },
  minecraft: {
    label: "Minecraft",
    rankLabel: null,
    gameNameLabel: "プロフィール名／ゲーマータグ",
    gameNamePlaceholder: "Javaはプロフィール名、統合版はゲーマータグ",
    gameIdLabel: null,
    notesLabel: "エディション等（任意）",
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
