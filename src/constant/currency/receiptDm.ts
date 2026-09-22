import { ACTION_TYPES as A } from "./action";
import type { ReceiptDmDefinition } from "../../type/currency/receiptDm";

export const RECEIPT_DM_HISTORY_URL = "https://discord.com/channels/1534636292153807039/1534648842719465683";

// 対象取引の受取人全員へ通知する。紋章支払い・購入代金は対象外。
export const RECEIPT_DM_DEFINITIONS: Record<string, ReceiptDmDefinition> = {
  [A.TRANSFER]: { title: "💸 送金を受け取りました", verb: "が届きました。", balanceLabel: "受取後", humanSender: true },
  [A.CASINO_GF]: { title: "💸 GFの送金を受け取りました", verb: "が届きました。", balanceLabel: "受取後", humanSender: true },
  [A.CASINO_MAHJONG]: { title: "💸 麻雀の送金を受け取りました", verb: "が届きました。", balanceLabel: "受取後", humanSender: true },
  [A.CASINO_OTHER]: { title: "💸 その他の賭博送金を受け取りました", verb: "が届きました。", balanceLabel: "受取後", humanSender: true },
  [A.SUPERCHAT]: { title: "🎤 スパチャを受け取りました", verb: "のスパチャが届きました。", balanceLabel: "受取後", humanSender: true, commentLabel: "コメント" },
  [A.ADMIN_MINT]: { title: "🎁 LIAが付与されました", verb: "が付与されました。", balanceLabel: "付与後" },
  [A.ROLE_BASED_GRANT]: { title: "🎁 LIAが付与されました", verb: "が付与されました。", balanceLabel: "付与後" },
  [A.ADMIN_BURN]: { title: "📉 LIAが剥奪されました", verb: "が剥奪されました。", balanceLabel: "剥奪後" },
  [A.SALARY_PAYMENT]: { title: "💰 給料が振り込まれました", verb: "の給料が振り込まれました。", balanceLabel: "振込後" },
  [A.SERVER_BOOST_REWARD]: { title: "🚀 ブースト報酬が届きました", verb: "のブースト報酬が付与されました。", balanceLabel: "付与後" },
  [A.ROULETTE_PAYOUT]: { title: "🎰 ルーレットの配当が届きました", verb: "の配当が振り込まれました。", balanceLabel: "受取後" },
  [A.ROULETTE_BONUS]: { title: "🎁 参加ボーナスが届きました", verb: "のルーレット参加ボーナスが付与されました。", balanceLabel: "付与後" },
  [A.OMIKUJI_DRAW]: { title: "⛩️ おみくじ報酬が届きました", verb: "のおみくじ報酬が付与されました。", balanceLabel: "付与後", commentLabel: "運勢" },
  [A.TICKET_EXCHANGE]: { title: "🎫 換金額が振り込まれました", verb: "の換金額が振り込まれました。", balanceLabel: "振込後" },
};
