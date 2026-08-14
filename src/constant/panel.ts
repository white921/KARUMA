import { CURRENCY_NAMES } from "./currency";
import { GAME_PRICE } from "./game";
import { HOTEL_TYPE_NAMES, HOTEL_PRICE } from "./hotel";
import { BOT_ID } from "./id";

export const PANEL_MESSAGES = {
  TITLE: "LEVELIA銀行窓口",
  VIEW: "残高確認",
  HISTORY: "取引履歴",
  SEND: `${CURRENCY_NAMES}送金`,
  SHOP_SEND: `${CURRENCY_NAMES}支払い`,
  ERROR: `${CURRENCY_NAMES}銀行窓口チャンネルが見つからないか、無効な型です。`,
  DESCRIPTION: `ボタンを押して各操作を行ってください。\nスマートフォンでの操作を推奨しています。\n銀行への送金は<@${BOT_ID}>宛てに行ってください。`,
  BUTTON_NOT_FOUND: "押下されたボタンは登録されていません",
};

export const DIARY_PANEL_MESSAGES = {
  TITLE: "日記パネル",
  DESCRIPTION:
    `日記作成: 5,000 ${CURRENCY_NAMES}\n\n※3日間連続で投稿がない場合、自動で日記がクローズします。\nこちらのパネルでもう一度作成を行うと日記が再開されます。（要5,000${CURRENCY_NAMES}）`,
  PRIVATE: "通常日記",
  PUBLIC: "日記を作成",
  UPDATE: "アップグレード",
  ERROR: "日記パネルチャンネルが見つからないか、無効な型です。",
  CHANNEL_NOT_CONFIGURED:
    "日記パネルチャンネルが未設定です。`TEXT_CHANNEL_IDS.DIARY_PANEL` を設定してください。",
};

export const ADMIN_PANEL_MESSAGES = {
  TITLE: "管理者パネル",
  DESCRIPTION: "管理者パネルです。\nボタンを押して各操作を行ってください。",
  ERROR: "管理者パネルチャンネルが見つからないか、無効な型です。",
  VIEW: "指定ユーザーの残高確認",
  BURN: `指定ユーザーからの${CURRENCY_NAMES}減額`,
  MINT: `指定ユーザーへの${CURRENCY_NAMES}付与`,
  CHANGE_NAME: "指定ユーザーの表示名変更",
};

const NORMAL_HOTEL_PRICE_GUIDANCE = [
  `旅人・騎士：${HOTEL_PRICE.NORMAL}${CURRENCY_NAMES}/12時間`,
  `賢者：${HOTEL_PRICE.NORMAL / 2}${CURRENCY_NAMES}/12時間`,
  "貴族以上：無料",
].join("\n");
export const HOTEL_VC_PANEL_MESSAGES = {
  TITLE: "ホテルVCパネル",
  DESCRIPTION: `ボタンを押してホテルを選択してください。\nスマートフォンでの操作を推奨しています。\n\n**【ホテル案内】**\n**・ ${HOTEL_TYPE_NAMES.NORMAL}**\n${NORMAL_HOTEL_PRICE_GUIDANCE}\n通常ツーショットVC\n\n**・ ${HOTEL_TYPE_NAMES.SECRET}**\n${HOTEL_PRICE.SECRET}${CURRENCY_NAMES}/12時間\n管理者以外に見えないツーショットVC\n\n**・ ${HOTEL_TYPE_NAMES.SECRETLONG}**\n${HOTEL_PRICE.SECRETLONG}${CURRENCY_NAMES}/24時間\n管理者以外に見えないツーショットVC\n\n**・ ${HOTEL_TYPE_NAMES.FREEDOM}**\n${HOTEL_PRICE.FREEDOM}${CURRENCY_NAMES}/12時間\n大人数で自由に利用できるVC\n\n**・ ${HOTEL_TYPE_NAMES.FREEDOMLONG}**\n${HOTEL_PRICE.FREEDOMLONG}${CURRENCY_NAMES}/24時間\n大人数で自由に利用できるVC`,
  NORMAL_DESCRIPTION: `\nボタンを押してホテルを選択してください。\nスマートフォンでの操作を推奨しています。\n\n**【ホテル案内】**\n**・ ${HOTEL_TYPE_NAMES.NORMAL}**\n${NORMAL_HOTEL_PRICE_GUIDANCE}\n通常ツーショットVC\n\n`,
  SPECIAL_DISCRIPTION: `\nボタンを押してホテルを選択してください。\nスマートフォンでの操作を推奨しています。\n\n**【ホテル案内】**\n**・ ${HOTEL_TYPE_NAMES.SECRET}**\n${HOTEL_PRICE.SECRET}${CURRENCY_NAMES}/12時間\n管理者以外に見えないツーショットVC\n\n**・ ${HOTEL_TYPE_NAMES.SECRETLONG}**\n${HOTEL_PRICE.SECRETLONG}${CURRENCY_NAMES}/24時間\n管理者以外に見えないツーショットVC\n\n**・ ${HOTEL_TYPE_NAMES.FREEDOM}**\n${HOTEL_PRICE.FREEDOM}${CURRENCY_NAMES}/12時間\n大人数で自由に利用できるVC\n\n**・ ${HOTEL_TYPE_NAMES.FREEDOMLONG}**\n${HOTEL_PRICE.FREEDOMLONG}${CURRENCY_NAMES}/24時間\n大人数で自由に利用できるVC`,
  ERROR: "ホテルVCパネルチャンネルが見つからないか、無効な型です。",
  CANCEL: "❌ キャンセルしました。",
  NORMAL: HOTEL_TYPE_NAMES.NORMAL,
  SECRET: HOTEL_TYPE_NAMES.SECRET,
  FREEDOM: HOTEL_TYPE_NAMES.FREEDOM,
  CHANGE_VC_LIMIT: "人数変更",
  CHANGE_VC_NAME: "VC名変更",
  TICKET_VIEW: "チケット確認",
};

export const IN_CHAT_PANEL_MESSAGES = {
  TITLE: "VC操作パネル",
  DESCRIPTION: "ボタンを押して各操作を行ってください。。",
};

export const CASINO_PANEL_MESSAGES = {
  TITLE: "賭博パネル",
  DESCRIPTION:
    "賭博パネルです。\nボタンを押して対象の賭博を選択してください。\nスマートフォンでの操作を推奨しています。",
  ERROR: "賭博パネルチャンネルが見つからないか、無効な型です。",
  GF: "GF",
  MAJONG: "麻雀",
  OTHER: "その他",
};

export const GAME_PANEL_MESSAGES = {
  TITLE: "遊戯パネル",
  DESCRIPTION: `遊戯パネルです。\nボタンを押して利用したい時間を選択してください。\nまた、ボタンを押して購入したいパスを選択してください。\nスマートフォンでの操作を推奨しています。\n\n**【遊戯案内】**\n**・6時間プラン**：${GAME_PRICE.SHORT}${CURRENCY_NAMES}\n購入後6時間までご利用できます。遊戯チケットを所持している場合は、料金より優先して1枚消費します。\n\n**・12時間プラン**：${GAME_PRICE.LONG}${CURRENCY_NAMES}\n購入後12時間までご利用できます。\n\n**・ゲームパス**：${GAME_PRICE.PASS}${CURRENCY_NAMES}\nゲームパスを購入できます。\n有効期限：購入した月の月末まで。\n購入後は6時間・12時間プランを押して転送VC、または作成されているVCへ移動してください。\n※ゲームパスを購入する前に時間プランを押すと、通常通り引き落としが発生します。\nゲームパスを購入し、そのままVCを利用する場合は、**ゲームパス → プラン選択**の順で操作してください。\n\n**・チケット確認**：所持している全種類のチケットと枚数を確認できます。\n\n**・残高確認**：現在の${CURRENCY_NAMES}残高を確認できます。`,
  SHORT: "6時間プラン",
  LONG: "12時間プラン",
  GAME_PASS: "ゲームパス",
  TICKET_VIEW: "チケット確認",
};

export const HAZAMA_PANEL_MESSAGES = {
  TITLE: "辺境の狭間 パネル",
  DESCRIPTION: `辺境の狭間に入るための滞在許可証を購入できます。\n\n**【滞在許可証】**\n1,000${CURRENCY_NAMES}／12時間\n購入後12時間まで、辺境の狭間をご利用できます。\n\n**・残高確認**：現在の${CURRENCY_NAMES}残高を確認できます。`,
  ACCESS: "滞在許可証を購入",
  ERROR: "辺境の狭間パネルチャンネルが見つからないか、無効な型です。",
};

export const SHOP_PANEL_MESSAGES = {
  TITLE: "市場パネル",
  DESCRIPTION:
    `市場の商品購入はこちらのパネルから行ってください。\n購入前に使用するチケットを選択し、商品名と割引適用後の購入金額を入力してください。\n\n**【市場ガチャ】**\n1回5,000${CURRENCY_NAMES}または招待ポイント1pt／合計で1日5回まで。\n商品案内は[市場について](https://discord.com/channels/1534636292153807039/1534644038248960231)にてご確認いただけます。`,
  VIEW: "残高確認",
  SHOP_SEND: "商品購入",
  TICKET_VIEW: "チケット確認",
  MARKET_GACHA_DRAW: "市場ガチャを引く",
  INVITE_POINT_GACHA_DRAW: "招待ポイントでガチャ (1pt)",
  ERROR: "市場パネルチャンネルが見つからないか、無効な型です。",
};

export const DARK_SHOP_PANEL_MESSAGES = {
  TITLE: "闇市場パネル",
  DESCRIPTION:
    `闇市場の商品購入はこちらのパネルから行ってください。\n市場割引券は使用できません。\n商品案内は[闇市場](https://discord.com/channels/1534636292153807039/1534638452086276209)にてご確認いただけます。\n\n闇手紙・悪魔の囁きの匿名送信機能は準備中です。購入後の対応は運営へお問い合わせください。`,
  ERROR: "闇市場パネルチャンネルが見つからないか、無効な型です。",
};

export const CREATOR_EMBLEM_PANEL_MESSAGES = {
  TITLE: "夢印工房パネル",
  DESCRIPTION:
    `紋章の制作依頼に伴う送金はこちらから行ってください。\n支払い前に商品と夢印屋さんを選択し、内容を確認してください。\n\n**【料金】**\n・個人紋章：賢者 100,000${CURRENCY_NAMES}／貴族 60,000${CURRENCY_NAMES}\n・デカ紋章：貴族 150,000${CURRENCY_NAMES}\n\n※個人紋章・デカ紋章とも、夢印屋さんへ直接送金されます。`,
  PAY: "支払い",
  VIEW: "残高確認",
  ERROR: "夢印工房パネルチャンネルが見つからないか、無効な型です。",
  MEMBER_ONLY: "賢者または貴族のみ利用できます。",
  APOSTLE_ONLY: "デカ紋章は貴族のみ利用できます。",
  NO_CREATOR: "現在、選択できる夢印屋さん・夢印屋さん店長がいません。",
  INVALID_CREATOR: "選択したユーザーは夢印屋さんまたは夢印屋さん店長ではありません。",
};

export const OMIKUJI_PANEL_MESSAGES = {
  TITLE: "今日の運勢おみくじ",
  DESCRIPTION:
    `おみくじ: 無料\n\n※日本時間で1日1回まで引けます。\n※サブアカウントは利用できません。\n※凶が出ても残高がマイナスになることはありません。\n\n小吉：+1,000 ${CURRENCY_NAMES}（34.5%）\n中吉：+2,000 ${CURRENCY_NAMES}（59%）\n大吉：+5,000 ${CURRENCY_NAMES}（5%）\n凶：-3,000 ${CURRENCY_NAMES}（1%）\n超大吉：+50,000 ${CURRENCY_NAMES}（0.5%）`,
  DRAW: "おみくじを引く",
  ERROR: "おみくじパネルチャンネルが見つからないか、無効な型です。",
};

export const REDEPLOY_PANEL_MESSAGES = {
  TITLE: "Bot再起動パネル",
  DESCRIPTION: "Bot再起動用のパネルです。\nBotが止まっている時以外押さないでください。",
  ERROR: "Bot再起動パネルチャンネルが見つからないか、無効な型です。",
  BUTTON: "Bot再起動",
};
