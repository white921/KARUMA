import { CURRENCY_NAMES } from "./currency";
import { GAME_PRICE } from "./game";
import { HOTEL_TYPE_NAMES, HOTEL_PRICE } from "./hotel";
import { BOT_ID } from "./id";

export const PANEL_MESSAGES = {
  TITLE: "教団銀行窓口",
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
    "日記パネルです。\nボタンを押して作成したい日記の種類を選択してください。\nスマートフォンでの操作を推奨しています。",
  PRIVATE: "通常日記",
  PUBLIC: "VIP日記",
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

export const HOTEL_VC_PANEL_MESSAGES = {
  TITLE: "ホテルVCパネル",
  DESCRIPTION: `ボタンを押してホテルを選択してください。\nスマートフォンでの操作を推奨しています。\n\n**【ホテル案内】**\n**・ ${HOTEL_TYPE_NAMES.NORMAL}**\n${HOTEL_PRICE.NORMAL}${CURRENCY_NAMES}/12h\n通常ツーショットVC\n※使徒・教団員ロール所持者は無料のため、残高の引き落としはありません。\n\n**・ ${HOTEL_TYPE_NAMES.SECRET}**\n${HOTEL_PRICE.SECRET}${CURRENCY_NAMES}/12h\n管理者以外に見えないツーショットVC\n\n**・ ${HOTEL_TYPE_NAMES.SECRETLONG}**\n${HOTEL_PRICE.SECRETLONG}${CURRENCY_NAMES}/24h\n管理者以外に見えないツーショットVC\n\n**・ ${HOTEL_TYPE_NAMES.FREEDOM}**\n${HOTEL_PRICE.FREEDOM}${CURRENCY_NAMES}/12h\n大人数で自由に利用できるVC\n\n**・ ${HOTEL_TYPE_NAMES.FREEDOMLONG}**\n${HOTEL_PRICE.FREEDOMLONG}${CURRENCY_NAMES}/24h\n大人数で自由に利用できるVC`,
  NORMAL_DESCRIPTION: `\nボタンを押してホテルを選択してください。\nスマートフォンでの操作を推奨しています。\n\n**【ホテル案内】**\n**・ ${HOTEL_TYPE_NAMES.NORMAL}**\n${HOTEL_PRICE.NORMAL}${CURRENCY_NAMES}/12h\n通常ツーショットVC\n※使徒・教団員ロール所持者は無料のため、残高の引き落としはありません。\n\n`,
  SPECIAL_DISCRIPTION: `\nボタンを押してホテルを選択してください。\nスマートフォンでの操作を推奨しています。\n\n**【ホテル案内】**\n**・ ${HOTEL_TYPE_NAMES.SECRET}**\n${HOTEL_PRICE.SECRET}${CURRENCY_NAMES}/12h\n管理者以外に見えないツーショットVC\n\n**・ ${HOTEL_TYPE_NAMES.SECRETLONG}**\n${HOTEL_PRICE.SECRETLONG}${CURRENCY_NAMES}/24h\n管理者以外に見えないツーショットVC\n\n**・ ${HOTEL_TYPE_NAMES.FREEDOM}**\n${HOTEL_PRICE.FREEDOM}${CURRENCY_NAMES}/12h\n大人数で自由に利用できるVC\n\n**・ ${HOTEL_TYPE_NAMES.FREEDOMLONG}**\n${HOTEL_PRICE.FREEDOMLONG}${CURRENCY_NAMES}/24h\n大人数で自由に利用できるVC`,
  ERROR: "ホテルVCパネルチャンネルが見つからないか、無効な型です。",
  CANCEL: "❌ キャンセルしました。",
  NORMAL: HOTEL_TYPE_NAMES.NORMAL,
  SECRET: HOTEL_TYPE_NAMES.SECRET,
  FREEDOM: HOTEL_TYPE_NAMES.FREEDOM,
  CHANGE_VC_LIMIT: "人数変更",
  CHANGE_VC_NAME: "VC名変更",
};

export const IN_CHAT_PANEL_MESSAGES = {
  TITLE: "VC操作パネル",
  DESCRIPTION: "ボタンを押して各操作を行ってください。。",
};

export const CASINO_PANEL_MESSAGES = {
  TITLE: "カジノパネル",
  DESCRIPTION:
    "カジノパネルです。\nボタンを押して対象のゲームを選択してください。\nスマートフォンでの操作を推奨しています。",
  ERROR: "カジノパネルチャンネルが見つからないか、無効な型です。",
  GF: "GF",
  MAJONG: "麻雀",
  OTHER: "その他",
};

export const GAME_PANEL_MESSAGES = {
  TITLE: "戯境パネル",
  DESCRIPTION: `戯境パネルです。\nボタンを押して利用したい時間を選択してください。\nまた、ボタンを押して購入したいPASSを選択してください。\nスマートフォンでの操作を推奨しています。\n\n**【戯境案内】**\n**・6時間プラン**：${GAME_PRICE.SHORT}${CURRENCY_NAMES}\n購入後6時間までご利用できます。\n\n**・12時間プラン**：${GAME_PRICE.LONG}${CURRENCY_NAMES}\n購入後12時間までご利用できます。\n\n**・戯境パス**：${GAME_PRICE.PASS}${CURRENCY_NAMES}\n戯境パスを購入出来ます。\n有効期限：購入した月の月末まで。\n購入後は6時間・12時間プランを押して転送VC、または作成されているVCへ移動してください。\n※戯境パスを購入する前に時間プランを押すと、通常通り引き落としが発生します。\nPASSを購入し、そのままVCの利用をする場合は、**戯境パス → プラン選択**の順で操作してください。\n\n**・残高確認**：現在の${CURRENCY_NAMES}残高を確認できます。`,
  SHORT: "6時間プラン",
  LONG: "12時間プラン",
  GAME_PASS: "戯境パス",
};

export const SHOP_PANEL_MESSAGES = {
  TITLE: "ショップパネル",
  DESCRIPTION:
    "ショップの支払いはこちらのパネルから行ってください。\n コメントにて購入される商品名を明記してください。",
  VIEW: "残高確認",
  SHOP_SEND: `${CURRENCY_NAMES}支払い`,
  ERROR: "ショップパネルチャンネルが見つからないか、無効な型です。",
};

export const REDEPLOY_PANEL_MESSAGES = {
  TITLE: "Bot再起動パネル",
  DESCRIPTION: "Bot再起動用のパネルです。\nBotが止まっている時以外押さないでください。",
  ERROR: "Bot再起動パネルチャンネルが見つからないか、無効な型です。",
  BUTTON: "Bot再起動",
};
