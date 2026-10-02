import { THREAD_IDS } from "../shared/id";

export const COMPETITION_ENTRY_PREFIX = "competitionEntry";
export const COMPETITION_ENTRY_PANEL_TITLE =
  "第１回 LEVELIA双璧戦 競技エントリーシート";
export const COMPETITION_ENTRY_PANEL_CHANNEL_ID =
  THREAD_IDS.COMPETITION_ENTRY_PANEL;

export const COMPETITION_ENTRY_ACTIONS = {
  OPEN: `${COMPETITION_ENTRY_PREFIX}:open`,
  REVIEW: `${COMPETITION_ENTRY_PREFIX}:review`,
  SCHEDULE_EDIT: `${COMPETITION_ENTRY_PREFIX}:schedule:edit`,
  SCHEDULE_MODAL: `${COMPETITION_ENTRY_PREFIX}:schedule:modal`,
  OW_BASIC_EDIT: `${COMPETITION_ENTRY_PREFIX}:ow-basic:edit`,
  OW_ROLE_EDIT_PREFIX: `${COMPETITION_ENTRY_PREFIX}:ow-role:edit`,
  OW_ROLE_MODAL_PREFIX: `${COMPETITION_ENTRY_PREFIX}:ow-role:modal`,
  EDIT: "edit",
  MODAL: "modal",
} as const;

export const COMPETITION_ENTRY_INPUT_IDS = {
  AVAILABILITY: "availability",
  RANK: "rank_name",
  RANK_DIVISION: "rank_division",
  GAME_NAME: "game_name",
  GAME_ID: "game_id",
  MINECRAFT_ROLES: "minecraft_roles",
  NOTES: "notes",
  DAY1: "day_1",
  DAY2: "day_2",
  DAY3: "day_3",
  OVERALL_NOTES: "overall_notes",
} as const;

export const COMPETITION_DISCIPLINES = {
  singing: {
    label: "歌",
    rankLabel: null,
    gameNameLabel: null,
    gameNamePlaceholder: null,
    gameIdLabel: null,
    notesLabel: "備考（任意）",
    notesPlaceholder: "例：得意な音域、参加可能な時間帯",
  },
  unite: {
    label: "Pokémon UNITE",
    rankLabel: "現在のランク",
    rankPlaceholder: "例：マスター（レート1400）",
    gameNameLabel: "トレーナー名",
    gameNamePlaceholder: "例：UNITEで公開されている名前",
    gameIdLabel: "トレーナーID",
    gameIdPlaceholder: "プロフィールに表示されるトレーナーID",
    notesLabel: "備考（任意）",
    notesPlaceholder: "例：得意レーン、よく使うポケモン、参加可能時間",
  },
  gf: {
    label: "GF",
    rankLabel: "決闘レーティング（分かる場合）",
    rankPlaceholder: "例：1500",
    gameNameLabel: "預言者の名前",
    gameNamePlaceholder: "GFで使用する預言者の名前",
    gameIdLabel: null,
    notesLabel: "備考（任意）",
    notesPlaceholder: "例：参加可能な時間帯",
  },
  mahjong: {
    label: "麻雀（雀魂）",
    rankLabel: "雀魂の段位",
    rankPlaceholder: "例：雀傑2、雀豪1",
    gameNameLabel: "雀魂のゲーム内ネーム",
    gameNamePlaceholder: "雀魂で表示される名前",
    gameIdLabel: "雀魂のプレイヤーID",
    gameIdPlaceholder: "プロフィールに表示される数字のプレイヤーID",
    notesLabel: "備考（任意）",
    notesPlaceholder: "例：四麻／三麻、参加可能な時間帯",
  },
  fall_guys: {
    label: "Fall Guys",
    rankLabel: "Ranked Knockoutの現在ランク",
    rankPlaceholder: "例：Gold、Ace、Superstar",
    gameNameLabel: "ゲーム内の表示名",
    gameNamePlaceholder: "PC・SwitchはEpic表示名、PS・Xboxは各ID",
    gameIdLabel: null,
    notesLabel: "使用機種（任意）",
    notesPlaceholder: "例：PC、Switch、PlayStation、Xbox",
  },
  valorant: {
    label: "VALORANT",
    rankLabel: "現在のランク",
    rankPlaceholder: "例：ゴールド2、ダイヤモンド1",
    gameNameLabel: "Riot ID（ゲーム名#タグライン）",
    gameNamePlaceholder: "例：PlayerName#JP1",
    gameIdLabel: null,
    notesLabel: "備考（任意）",
    notesPlaceholder: "例：メインロール、使用エージェント、参加可能時間",
  },
  ow: {
    label: "Overwatch",
    rankLabel: null,
    gameNameLabel: "BattleTag",
    gameNamePlaceholder: "例：PlayerName#12345",
    gameIdLabel: null,
    notesLabel: "備考（任意）",
    notesPlaceholder: "例：得意なロール、使用ヒーロー、参加可能時間",
  },
  lol: {
    label: "League of Legends",
    rankLabel: "現在のランク（ソロ／デュオ）",
    rankPlaceholder: "例：ゴールドIV、エメラルドII",
    gameNameLabel: "Riot ID（ゲーム名#タグライン）",
    gameNamePlaceholder: "例：PlayerName#JP1",
    gameIdLabel: null,
    notesLabel: "メインロール等（任意）",
    notesPlaceholder: "例：TOP、JG、MID、ADC、SUP",
  },
  minecraft: {
    label: "Minecraft",
    rankLabel: null,
    gameNameLabel: "マイクラ内の名前（任意）",
    gameNamePlaceholder: "例：ゲーム内で表示される名前",
    gameIdLabel: null,
    notesLabel: "マイクラのアピールポイント（任意）",
    notesPlaceholder: "例：大規模建築が得意、自動仕分け機を作れます",
  },
} as const;

export const MINECRAFT_ROLES = {
  exploration: "攻略・探索",
  building: "建築",
  automation: "自動機・装置作成",
  groundwork: "整地・採掘などの単純作業",
  gathering: "資材収集",
  other: "その他",
} as const;

export type MinecraftRoleKey = keyof typeof MINECRAFT_ROLES;

export const COMPETITION_RANK_CONFIGS = {
  unite: {
    tierLabel: "ランク帯（ティア）",
    tiers: ["ビギナー", "スーパー", "ハイパー", "エリート", "エキスパート", "マスター"],
    divisionLabel: "クラス／マスターレート",
    divisionPlaceholder: "クラスは1～5、マスターはレート（例：1400）",
  },
  mahjong: {
    tierLabel: "雀魂の段位",
    tiers: ["初心", "雀士", "雀傑", "雀豪", "雀聖", "魂天"],
    divisionLabel: "段階",
    divisionPlaceholder: "初心～雀聖は1～3、魂天は1～20",
  },
  fall_guys: {
    tierLabel: "ランク帯（ティア）",
    tiers: [
      "ルーキー", "挑戦者", "ブロンズ", "シルバー",
      "ゴールド", "エース", "スター", "スーパースター",
    ],
    divisionLabel: "サブランク",
    divisionPlaceholder: "1～3または1～5（スーパースターは空欄）",
  },
  valorant: {
    tierLabel: "ランク帯（ティア）",
    tiers: [
      "アイアン", "ブロンズ", "シルバー", "ゴールド", "プラチナ",
      "ダイヤモンド", "アセンダント", "イモータル", "レディアント",
    ],
    divisionLabel: "ディビジョン",
    divisionPlaceholder: "1～3（レディアントは空欄）",
  },
  lol: {
    tierLabel: "ランク帯（ティア）",
    tiers: [
      "アイアン", "ブロンズ", "シルバー", "ゴールド", "プラチナ",
      "エメラルド", "ダイヤモンド", "マスター", "グランドマスター", "チャレンジャー",
    ],
    divisionLabel: "ディビジョン",
    divisionPlaceholder: "1～4（マスター以上は空欄）",
  },
} as const satisfies Partial<
  Record<
    keyof typeof COMPETITION_DISCIPLINES,
    {
      tierLabel: string;
      tiers: readonly string[];
      divisionLabel: string;
      divisionPlaceholder: string;
    }
  >
>;

export const OVERWATCH_RANK_TIERS = [
  "ブロンズ",
  "シルバー",
  "ゴールド",
  "プラチナ",
  "エメラルド",
  "ダイヤモンド",
  "マスター",
  "グランドマスター",
  "チャンピオン",
] as const;

export const OVERWATCH_ROLES = {
  tank: "タンク",
  damage: "ダメージ",
  support: "サポート",
} as const;

export type OverwatchRoleKey = keyof typeof OVERWATCH_ROLES;

export function competitionOwRoleCustomId(
  action: "edit" | "modal",
  role: OverwatchRoleKey,
): string {
  return `${COMPETITION_ENTRY_PREFIX}:ow-role:${action}:${role}`;
}

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
